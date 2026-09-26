# DataPilot AI Model Training Worklist

## Current Status (2026-09-26)

The user selected `Qwen/Qwen2.5-1.5B-Instruct` for local training on the
6 GB GPU. LoRA training completed for three epochs (126 optimizer steps),
and the adapter is saved in `ai/training/checkpoints/datapilot-qwen2.5-1.5b-lora`.
See `ai/training/LOCAL_1_5B.md` for results and run commands.
The existing Ollama 7B model is not fine-tuned and is not automatically replaced.
The worklist below records the original plan, including future dataset expansion.

## Goal

Train and serve one open-source/fine-tuned model for this single job:

```text
Natural language data requirement -> valid DataPilot WorkflowSpecification JSON
```

The model should not browse, scrape, validate, deduplicate, or call APIs. Those steps stay in the deterministic workflow code.

## Original Model Selection

Primary choice: `Qwen/Qwen2.5-7B-Instruct`

Why:
- Good fit for instruction-to-JSON tasks.
- 7B size is realistic for QLoRA fine-tuning.
- Supports long context, useful if requirements become detailed.
- Easier open-weight workflow than gated Llama models.

Backup choices:
- `meta-llama/Llama-3.1-8B-Instruct`
- `mistralai/Mistral-7B-Instruct-v0.3`

## Work To Do

### 1. Fix the training target

- Confirm that the expected output schema is exactly `WorkflowSpecification` from `ai/app/schemas/workflow.py`.
- Keep these required output keys in every training example:
  - `intent`
  - `target_count`
  - `entity_type`
  - `filters`
  - `fields`
  - `source_types`
  - `deduplication_key`
  - `validation_rules`
- Add a JSON schema validation step in `ai/training/scripts/prepare_data.py` so bad examples fail before training.

### 2. Expand the dataset

The original dataset contained `6` train, `1` validation, and `1` test examples.
It has now been expanded to `336` train, `42` validation, and `42` test examples.

Create at least:
- 300 examples for first useful fine-tune.
- 1,000+ examples for a stronger demo.
- 5,000+ examples if this becomes production-facing.

Cover these domains:
- Startups and companies
- Jobs
- Leads and contacts
- Events and hackathons
- Products
- Competitors
- Sponsors
- Market research
- Universities, grants, investors, SaaS tools, agencies, restaurants, creators, and local businesses

Add variation in:
- Target counts
- Countries, regions, cities
- Time filters
- Industry filters
- Requested fields
- Ambiguous phrasing
- Missing target count
- Multiple source preferences
- Different deduplication keys

### 3. Generate high-quality synthetic data

- Create a script like `ai/training/scripts/generate_synthetic_data.py`.
- Use templates plus controlled random variation.
- Validate every generated output against `WorkflowSpecification`.
- Avoid duplicate examples.
- Save the final canonical dataset to `ai/training/dataset/synthetic_dataset.json`.

### 4. Improve data preparation

- Shuffle examples before splitting.
- Use deterministic random seed.
- Save train/val/test splits with an 80/10/10 ratio.
- Add duplicate detection for similar instructions.
- Add basic quality checks:
  - Output must be valid JSON.
  - `fields` cannot be empty.
  - `deduplication_key` should reference requested fields when possible.
  - URL/email validation rules should only appear when relevant fields exist.

### 5. Fix or verify the training script

Check `ai/training/scripts/train_lora.py` before running full training:

- Verify `SFTTrainer` supports the current `dataset_text_field="messages"` setup.
- If needed, convert each `messages` list into one formatted chat string using the tokenizer chat template.
- Add validation dataset support.
- Add `eval_strategy`.
- Add `save_total_limit`.
- Add `max_steps` option for quick smoke tests.
- Log final train/eval loss.

### 6. Update the QLoRA config

Change `ai/training/configs/qlora_config.json`:

- Set `base_model_name` to `Qwen/Qwen2.5-7B-Instruct`.
- Keep LoRA rank around `16` for first run.
- Use `r=32` only if results are weak and GPU memory allows it.
- Add fields for:
  - `max_seq_length`
  - `warmup_ratio`
  - `weight_decay`
  - `eval_strategy`
  - `save_total_limit`
  - `seed`

### 7. Prepare training environment

Use a GPU machine if possible.

Install training-only dependencies:

```bash
cd ai
pip install torch transformers peft trl datasets bitsandbytes accelerate
```

Then run:

```bash
cd ai/training
python scripts/prepare_data.py
python scripts/train_lora.py --config configs/qlora_config.json
```

### 8. Add model evaluation

Create `ai/training/scripts/evaluate_model.py`.

Evaluate on `test.jsonl` with:
- Exact valid JSON rate
- Pydantic schema pass rate
- Required key presence
- Field extraction accuracy
- Target count accuracy
- Entity type accuracy
- Filter accuracy

Minimum demo acceptance:
- 95%+ valid JSON
- 90%+ schema pass rate
- 85%+ core field/entity accuracy

### 9. Serve the fine-tuned model

After training, serve the model adapter with an HTTP endpoint compatible with `ai/app/models/fine_tuned.py`.

Preferred serving options:
- vLLM with an OpenAI-compatible `/v1/chat/completions` endpoint
- Text Generation Inference
- Ollama only if adapter merging/export is handled cleanly

Runtime env:

```env
MODEL_PROVIDER=http
MODEL_NAME=datapilot-qwen2.5-7b-lora
MODEL_ENDPOINT=http://localhost:8001
```

### 10. Test integration with the AI service

Run:

```bash
cd ai
pytest tests/ -v
```

Then manually test:

```bash
uvicorn app.main:app --reload --port 8000
```

Check:
- `/health`
- `/api/v1/analyze`
- `/api/v1/workflow/plan`
- `/api/v1/workflows/run`

### 11. Add fallback safety

- Keep `MockRuleBasedModel` only for tests/offline mode.
- For production, fail clearly if the model endpoint is down.
- Log model raw output when JSON parsing fails.
- Add bad-output examples to the training dataset.

### 12. Final deliverables

- Expanded dataset
- Validated train/val/test splits
- Updated QLoRA config
- Working training script
- Fine-tuned LoRA checkpoint
- Evaluation report
- Running model endpoint
- FastAPI service connected to the model
- Passing tests

## Suggested First Sprint

1. Generate 300 validated examples.
2. Fix `prepare_data.py` validation and splitting.
3. Update config to `Qwen/Qwen2.5-7B-Instruct`.
4. Run a 20-step smoke test training job.
5. Fix any trainer/dataset formatting issues.
6. Run full QLoRA training.
7. Build `evaluate_model.py`.
8. Serve the adapter and connect `MODEL_ENDPOINT`.
