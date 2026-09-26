"""Run a DataPilot requirement through the locally trained LoRA adapter."""

import argparse
import json

from peft import PeftModel

from train_local import ROOT, generate, load_model, rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("requirement", help="Data requirement to convert to workflow JSON")
    args = parser.parse_args()
    cfg = json.loads((ROOT / "configs/local_1.5b.json").read_text())
    adapter = ROOT / cfg["output_dir"]
    if not (adapter / "adapter_model.safetensors").is_file():
        parser.error("No trained adapter found. Complete scripts/train_local.py first.")
    report = json.loads((adapter / "training_report.json").read_text())
    cfg = report["config"]
    cfg["revision"] = report["base_revision"]
    model, tokenizer = load_model(cfg, local_files_only=True)
    model = PeftModel.from_pretrained(model, adapter)
    model.eval()
    messages = [rows("train")[0]["messages"][0], {"role": "user", "content": args.requirement}]
    print(generate(model, tokenizer, messages))


if __name__ == "__main__":
    main()
