# DataPilot Fine-Tuning Suite (QLoRA / LoRA)

This directory contains training configurations, dataset preparation tools, synthetic datasets, and fine-tuning scripts to adapt base open-source instruct models (e.g. Llama-3, Mistral, Qwen, DeepSeek) into specialized DataPilot requirement parsing models.

> [!NOTE]
> Training dependencies are intentionally isolated to `ai/training/` so they are not loaded into the production API runtime.

---

## 1. Objective

The fine-tuned model has a single, highly specialized responsibility:

```text
Natural Language Business Requirement
                ↓
Structured DataPilot Workflow Specification (JSON)
```

The model is **NOT** trained to browse the web, execute Python scripts, click buttons, or query database tables. Those duties are strictly managed by LangGraph and deterministic tools.

---

## 2. Training Data Architecture

Training pairs follow an instruction-response contract:

- **Instruction**: Natural language data requirement query.
- **Output**: JSON string matching `WorkflowSpecification`:

```json
{
  "intent": "find_saas_startups",
  "target_count": 100,
  "entity_type": "company",
  "filters": {
    "country": "India",
    "industry": "SaaS",
    "founded_after": 2022
  },
  "fields": [
    "company_name",
    "founder",
    "website",
    "funding_stage",
    "linkedin_url"
  ],
  "source_types": [
    "company_website",
    "linkedin",
    "startup_database",
    "news"
  ],
  "deduplication_key": [
    "company_name",
    "website"
  ],
  "validation_rules": [
    "company_name_required",
    "website_valid_url",
    "linkedin_url_valid_url"
  ]
}
```

---

## 3. Directory Structure

```text
ai/training/
├── README.md                 # Training methodology and documentation
├── dataset/
│   └── synthetic_dataset.json# Multi-domain synthetic dataset
├── scripts/
│   ├── prepare_data.py       # Data validation & HuggingFace dataset formatter
│   └── train_lora.py         # PEFT / QLoRA training script using TRL SFTTrainer
└── configs/
    └── qlora_config.json     # Hyperparameters and LoRA target module settings
```

---

## 4. Fine-Tuning Execution Steps

1. Install training requirements:
   ```bash
   pip install torch transformers peft trl datasets bitsandbytes
   ```
2. Format dataset:
   ```bash
   python scripts/prepare_data.py
   ```
3. Launch QLoRA training:
   ```bash
   python scripts/train_lora.py --config configs/qlora_config.json
   ```
4. Serve fine-tuned adapter via vLLM or Ollama:
   ```bash
   vllm serve datapilot-model-v1 --port 8001
   ```
5. Set runtime environment variable:
   ```env
   MODEL_PROVIDER=http
   MODEL_ENDPOINT=http://localhost:8001
   ```
