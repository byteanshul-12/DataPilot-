"""Local 4-bit LoRA training with answer-only loss and held-out checks."""

import argparse
import hashlib
import json
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig,
    DataCollatorForSeq2Seq, Trainer, TrainingArguments, set_seed,
)

ROOT = Path(__file__).resolve().parents[1]


def load_model(cfg, *, local_files_only=False):
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is required for this local training configuration.")
    tokenizer = AutoTokenizer.from_pretrained(
        cfg["base_model_name"], revision=cfg.get("revision"), local_files_only=local_files_only)
    tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        cfg["base_model_name"],
        quantization_config=BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True,
        ),
        device_map={"": 0}, torch_dtype=torch.float16,
        attn_implementation="sdpa",
        revision=cfg.get("revision"), local_files_only=local_files_only,
    )
    return model, tokenizer


def rows(split):
    return [json.loads(line) for line in (ROOT / "dataset" / f"{split}.jsonl").read_text().splitlines()]


def encode(items, tokenizer, limit):
    encoded = []
    for item in items:
        messages = item["messages"]
        prefix = tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True)
        full = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=False)
        if full[:len(prefix)] != prefix:
            raise ValueError("Chat template prefix does not match training sequence.")
        if len(full) > limit:
            raise ValueError(f"Example has {len(full)} tokens, exceeding {limit}; refusing to truncate answers.")
        encoded.append({"input_ids": full, "attention_mask": [1] * len(full),
                        "labels": [-100] * len(prefix) + full[len(prefix):]})
    return Dataset.from_list(encoded)


def generate(model, tokenizer, messages):
    inputs = tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to("cuda")
    with torch.inference_mode():
        output = model.generate(inputs, attention_mask=torch.ones_like(inputs), max_new_tokens=512,
                                do_sample=False, pad_token_id=tokenizer.pad_token_id)
    return tokenizer.decode(output[0, inputs.shape[1]:], skip_special_tokens=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=str(ROOT / "configs/local_1.5b.json"))
    parser.add_argument("--resume", default=None)
    parser.add_argument("--evaluate-only", action="store_true")
    args = parser.parse_args()
    cfg = json.loads(Path(args.config).read_text())
    out = ROOT / cfg["output_dir"]
    set_seed(cfg["seed"])
    model, tokenizer = load_model(cfg)
    if args.evaluate_only:
        model = PeftModel.from_pretrained(model, out)
    else:
        model = prepare_model_for_kbit_training(model, gradient_checkpointing_kwargs={"use_reentrant": False})
        model = get_peft_model(model, LoraConfig(
            r=cfg["lora_r"], lora_alpha=cfg["lora_alpha"], lora_dropout=0.05,
            target_modules=cfg["target_modules"], task_type="CAUSAL_LM", bias="none"))
        model.print_trainable_parameters()
    train_rows, val_rows, test_rows = rows("train"), rows("val"), rows("test")
    prompt_sets = [{r["messages"][1]["content"] for r in split} for split in (train_rows, val_rows, test_rows)]
    assert not (prompt_sets[0] & prompt_sets[1] or prompt_sets[0] & prompt_sets[2] or prompt_sets[1] & prompt_sets[2])
    train_data = encode(train_rows, tokenizer, cfg["max_seq_length"])
    val_data = encode(val_rows, tokenizer, cfg["max_seq_length"])
    model.config.use_cache = False
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(out), per_device_train_batch_size=1, per_device_eval_batch_size=1,
            gradient_accumulation_steps=cfg["gradient_accumulation_steps"],
            num_train_epochs=cfg["num_train_epochs"], learning_rate=cfg["learning_rate"],
            fp16=True, gradient_checkpointing=True,
            gradient_checkpointing_kwargs={"use_reentrant": False},
            optim="adamw_torch", logging_steps=5, eval_strategy="epoch", save_strategy="epoch",
            save_total_limit=2, load_best_model_at_end=True, metric_for_best_model="eval_loss",
            greater_is_better=False, report_to="none", seed=cfg["seed"],
            warmup_ratio=0.03, dataloader_num_workers=0,
        ),
        train_dataset=train_data, eval_dataset=val_data,
        data_collator=DataCollatorForSeq2Seq(tokenizer, padding=True, label_pad_token_id=-100),
    )
    out.mkdir(parents=True, exist_ok=True)
    if not args.evaluate_only:
        baseline = trainer.evaluate()
        print("BASELINE", baseline, flush=True)
        result = trainer.train(resume_from_checkpoint=args.resume)
        final = trainer.evaluate()
        trainer.save_model(str(out))
        tokenizer.save_pretrained(out)
        report = {"config": cfg, "base_revision": model.config._commit_hash,
                  "train_examples": len(train_rows), "validation_examples": len(val_rows),
                  "test_examples": len(test_rows), "baseline": baseline, "final": final,
                  "training": result.metrics, "global_steps": trainer.state.global_step,
                  "dataset_sha256": {s: hashlib.sha256((ROOT / "dataset" / f"{s}.jsonl").read_bytes()).hexdigest()
                                     for s in ("train", "val", "test")}}
        (out / "training_report.json").write_text(json.dumps(report, indent=2))
    # Evaluate generated outputs separately; low loss alone does not establish usable JSON.
    model.eval()
    model.gradient_checkpointing_disable()
    model.config.use_cache = True
    checks = []
    for item in test_rows:
        raw = generate(model, tokenizer, item["messages"][:-1])
        expected = json.loads(item["messages"][-1]["content"])
        try:
            actual = json.loads(raw)
            valid = isinstance(actual, dict) and set(actual) == set(expected)
            correct = [key for key in expected if isinstance(actual, dict) and actual.get(key) == expected[key]]
        except ValueError:
            valid, correct = False, []
        checks.append({"prompt": item["messages"][1]["content"], "output": raw,
                       "valid_json_keys": valid, "correct_fields": correct, "exact_match": len(correct) == len(expected)})
        print(f"Test {len(checks)}/{len(test_rows)}: valid={valid}, correct_fields={len(correct)}/8", flush=True)
    summary = {"total": len(checks), "valid_json_keys": sum(c["valid_json_keys"] for c in checks),
               "exact_matches": sum(c["exact_match"] for c in checks), "examples": checks}
    (out / "test_report.json").write_text(json.dumps(summary, indent=2))
    print(f"Adapter and reports saved to {out}", flush=True)


if __name__ == "__main__":
    main()
