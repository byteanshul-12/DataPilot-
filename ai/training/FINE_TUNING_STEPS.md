# DataPilot Fine-Tuning Steps

## Current Status

Qwen2.5-1.5B-Instruct has now been fine-tuned locally with LoRA for three epochs
(126 optimizer steps). The saved adapter is at
`checkpoints/datapilot-qwen2.5-1.5b-lora/adapter_model.safetensors`.
See `LOCAL_1_5B.md` for the local training and inference commands.

The original 7B model has not been fine-tuned. The remaining instructions in
this document describe the earlier 7B training setup.

Prepared:
- `scripts/generate_synthetic_data.py`
- `scripts/prepare_data.py`
- `scripts/train_lora.py`
- `configs/qlora_config.json`
- `dataset/synthetic_dataset.json`
- `dataset/train.jsonl`
- `dataset/val.jsonl`
- `dataset/test.jsonl`

Dataset size:
- Train: 336 examples
- Validation: 42 examples
- Test: 42 examples

## Earlier 7B Attempt

The earlier attempt stopped at:

```text
Missing dependency: torch
```

CUDA PyTorch is now installed in `ai/training/.venv` for the completed 1.5B run.

Also, this laptop has an RTX 3050 with 6 GB VRAM. It can run the quantized Ollama model, but QLoRA fine-tuning a 7B model is likely to fail or be painfully slow on 6 GB VRAM.

Use a GPU machine with at least 16 GB VRAM. A 24 GB GPU is better.

## Recommended Training Machine

Use one of these:
- Google Colab Pro with A100/L4/T4, preferably A100 or L4
- RunPod
- Lambda Labs
- Vast.ai
- Any Linux CUDA machine with 16-24 GB VRAM

## Commands

From the project root:

```bash
cd ai/training
```

Install training dependencies:

```bash
pip install torch transformers peft trl bitsandbytes datasets accelerate
```

Generate and prepare the dataset:

```bash
python scripts/generate_synthetic_data.py
python scripts/prepare_data.py
```

Run QLoRA training:

```bash
python scripts/train_lora.py --config configs/qlora_config.json
```

Expected adapter output:

```text
ai/training/checkpoints/datapilot-qwen2.5-7b-lora
```

## Smoke Test First

Before full training, add this to `configs/qlora_config.json`:

```json
"max_steps": 20
```

Then run:

```bash
python scripts/train_lora.py --config configs/qlora_config.json
```

If that succeeds, remove `max_steps` and run full training.

## After Training

The output is a LoRA adapter, not a standalone model. To use it, either:

1. Serve the base Qwen model plus LoRA adapter with a compatible server, or
2. Merge the LoRA adapter into the base model and then quantize/serve it.

For the current hackathon app, the easiest practical runtime remains Ollama with the strict DataPilot prompt until the LoRA adapter is trained and served.
