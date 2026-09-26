# Local Qwen2.5-1.5B fine-tuning

Status: training completed on 2026-09-26. Three epochs and 126 optimizer steps
finished in 626 seconds on the RTX 3050 6 GB GPU. Validation loss decreased
from 0.803239 to 0.008051. The saved adapter contains 2,179,072 learned
parameters and occupies 8,731,128 bytes. All 42 held-out examples produced valid
JSON with the expected top-level keys and exact matches for all eight fields.

Run these commands in PowerShell from `ai/training`:

```powershell
.\.venv\Scripts\python.exe -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cu128
.\.venv\Scripts\python.exe -m pip install -r requirements-local.txt
$env:HF_HUB_DISABLE_XET="1"
$env:HF_HUB_DOWNLOAD_TIMEOUT="60"
.\.venv\Scripts\python.exe scripts/train_local.py
```

The script trains Qwen/Qwen2.5-1.5B-Instruct using 4-bit LoRA, rank 16,
on the existing 336 training examples for three epochs. Loss applies only to
assistant answers. The 42 validation examples select the best checkpoint;
42 separate test examples check generated JSON and exact expected field values.
These synthetic examples use closely related templates, so test performance
does not establish general accuracy on real user requests.

Outputs under `checkpoints/datapilot-qwen2.5-1.5b-lora`:

- `adapter_model.safetensors` and `adapter_config.json`: learned LoRA weights.
- `training_report.json`: dataset hashes, steps, baseline and final validation loss.
- `test_report.json`: generated held-out answers and correctness checks.

If generation evaluation is interrupted after the adapter is saved:

```powershell
.\.venv\Scripts\python.exe scripts/train_local.py --evaluate-only
```

To resume interrupted training, pass `--resume` with a saved `checkpoint-N`
directory. The adapter requires the matching 1.5B base model. It is not
automatically loaded by the project's existing Ollama 7B configuration.

After training, run the adapter directly:

```powershell
.\.venv\Scripts\python.exe scripts/run_adapter.py "Find 10 Indian SaaS startups with company name, founder, website and LinkedIn URL"
```

The inference command uses the cached base-model revision recorded in the
training report and does not need to download it again.
