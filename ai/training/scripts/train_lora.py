"""Fine-tune DataPilot requirement parsing with QLoRA / PEFT / TRL."""

from __future__ import annotations

import argparse
import inspect
import json
import os
import sys


def training_arguments_cls_kwargs(training_arguments_cls, cfg: dict) -> dict:
    params = inspect.signature(training_arguments_cls.__init__).parameters
    kwargs = {
        "output_dir": cfg.get("output_dir", "./checkpoints/datapilot-lora"),
        "per_device_train_batch_size": cfg.get("per_device_train_batch_size", 1),
        "per_device_eval_batch_size": cfg.get("per_device_eval_batch_size", 1),
        "gradient_accumulation_steps": cfg.get("gradient_accumulation_steps", 8),
        "learning_rate": cfg.get("learning_rate", 2e-4),
        "num_train_epochs": cfg.get("num_train_epochs", 3),
        "logging_steps": cfg.get("logging_steps", 10),
        "save_strategy": cfg.get("save_strategy", "epoch"),
        "save_total_limit": cfg.get("save_total_limit", 2),
        "warmup_ratio": cfg.get("warmup_ratio", 0.03),
        "weight_decay": cfg.get("weight_decay", 0.0),
        "report_to": cfg.get("report_to", "none"),
        "seed": cfg.get("seed", 42),
        "fp16": cfg.get("fp16", True),
    }
    eval_key = "eval_strategy" if "eval_strategy" in params else "evaluation_strategy"
    kwargs[eval_key] = cfg.get("eval_strategy", "epoch")
    if cfg.get("max_steps") is not None:
        kwargs["max_steps"] = cfg["max_steps"]
    return {k: v for k, v in kwargs.items() if k in params}


def run_training(config_path: str) -> None:
    print("=" * 60)
    print("DataPilot QLoRA Fine-Tuning Execution Engine")
    print("=" * 60)

    if not os.path.exists(config_path):
        print(f"Error: Config file not found at {config_path}")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    base_model_name = cfg.get("base_model_name", "Qwen/Qwen2.5-7B-Instruct")
    output_dir = cfg.get("output_dir", "./checkpoints/datapilot-qwen-lora")
    lora_r = cfg.get("lora_r", 16)
    lora_alpha = cfg.get("lora_alpha", 32)
    target_modules = cfg.get("target_modules", ["q_proj", "v_proj"])
    max_seq_length = cfg.get("max_seq_length", 1024)

    print(f"Base Model Target : {base_model_name}")
    print(f"Output Directory  : {output_dir}")
    print(f"LoRA Rank / Alpha : {lora_r} / {lora_alpha}")
    print(f"Target Modules    : {target_modules}")

    try:
        import torch
        from datasets import load_dataset
        from peft import LoraConfig, prepare_model_for_kbit_training
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
        from trl import SFTTrainer
    except ImportError as e:
        print("\n[NOTE] Training Environment Status:")
        print(f"Missing dependency: {e.name if hasattr(e, 'name') else e}")
        print("Install training packages on a CUDA machine:")
        print("pip install torch transformers peft trl bitsandbytes datasets accelerate")
        sys.exit(1)

    if not torch.cuda.is_available():
        print("[WARN] CUDA GPU was not detected. 7B QLoRA training will be extremely slow or fail.")

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type=cfg.get("bnb_4bit_quant_type", "nf4"),
        bnb_4bit_compute_dtype=torch.bfloat16 if cfg.get("bf16", False) else torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        quantization_config=bnb_config,
        device_map=cfg.get("device_map", "auto"),
        trust_remote_code=True,
    )
    model = prepare_model_for_kbit_training(model)

    peft_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=cfg.get("lora_dropout", 0.05),
        target_modules=target_modules,
        bias=cfg.get("bias", "none"),
        task_type=cfg.get("task_type", "CAUSAL_LM"),
    )

    dataset_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))
    dataset = load_dataset(
        "json",
        data_files={
            "train": os.path.join(dataset_dir, "train.jsonl"),
            "validation": os.path.join(dataset_dir, "val.jsonl"),
        },
    )

    def to_text(example):
        return {
            "text": tokenizer.apply_chat_template(
                example["messages"],
                tokenize=False,
                add_generation_prompt=False,
            )
        }

    dataset = dataset.map(to_text, remove_columns=["messages"])

    training_args = TrainingArguments(**training_arguments_cls_kwargs(TrainingArguments, cfg))

    trainer_kwargs = {
        "model": model,
        "train_dataset": dataset["train"],
        "eval_dataset": dataset["validation"],
        "peft_config": peft_config,
        "args": training_args,
    }
    trainer_params = inspect.signature(SFTTrainer.__init__).parameters
    if "dataset_text_field" in trainer_params:
        trainer_kwargs["dataset_text_field"] = "text"
    if "max_seq_length" in trainer_params:
        trainer_kwargs["max_seq_length"] = max_seq_length
    if "tokenizer" in trainer_params:
        trainer_kwargs["tokenizer"] = tokenizer
    elif "processing_class" in trainer_params:
        trainer_kwargs["processing_class"] = tokenizer

    trainer = SFTTrainer(**trainer_kwargs)

    print("[INFO] Starting model fine-tuning...")
    trainer.train()
    metrics = trainer.evaluate()
    print(f"[INFO] Eval metrics: {metrics}")

    trainer.model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"[SUCCESS] Model adapter saved successfully to: {output_dir}")


def main() -> None:
    default_config = os.path.join(os.path.dirname(__file__), "..", "configs", "qlora_config.json")
    parser = argparse.ArgumentParser(description="DataPilot QLoRA Fine-Tuning Execution Engine")
    parser.add_argument("--config", type=str, default=default_config)
    args = parser.parse_args()
    run_training(args.config)


if __name__ == "__main__":
    main()
