"""Validate and format DataPilot training data for supervised fine-tuning."""

from __future__ import annotations

import json
import os
import random
import sys
from typing import Any

SCRIPT_DIR = os.path.dirname(__file__)
TRAINING_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
AI_ROOT = os.path.abspath(os.path.join(TRAINING_DIR, ".."))
DATASET_PATH = os.path.join(TRAINING_DIR, "dataset", "synthetic_dataset.json")
OUTPUT_PATH = os.path.join(TRAINING_DIR, "dataset", "formatted_dataset.jsonl")
SEED = 42

sys.path.insert(0, AI_ROOT)

from app.schemas.workflow import WorkflowSpecification

SYSTEM_PROMPT = (
    "You are a DataPilot specialized AI. Convert the user data requirement into "
    "only one valid JSON object with these exact top-level keys: intent, "
    "target_count, entity_type, filters, fields, source_types, "
    "deduplication_key, validation_rules."
)


def validate_example(example: dict[str, Any], index: int) -> dict[str, Any]:
    instruction = example.get("instruction")
    output = example.get("output")
    if not isinstance(instruction, str) or not instruction.strip():
        raise ValueError(f"Example {index} has an empty instruction.")
    if not isinstance(output, dict):
        raise ValueError(f"Example {index} output must be a JSON object.")

    validated = WorkflowSpecification(**output).model_dump()
    if not validated["fields"]:
        raise ValueError(f"Example {index} has no fields.")
    if not validated["deduplication_key"]:
        raise ValueError(f"Example {index} has no deduplication_key.")

    fields = set(validated["fields"])
    dedupe = set(validated["deduplication_key"])
    if fields and not dedupe.intersection(fields):
        raise ValueError(f"Example {index} deduplication_key does not overlap fields.")

    return {"instruction": instruction.strip(), "output": validated}


def format_training_example(example: dict[str, Any]) -> dict[str, Any]:
    output_str = json.dumps(example["output"], indent=2, sort_keys=True)
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": example["instruction"]},
            {"role": "assistant", "content": output_str},
        ]
    }


def write_jsonl(path: str, items: list[dict[str, Any]]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for item in items:
            f.write(json.dumps(item, ensure_ascii=True) + "\n")


def main() -> None:
    print(f"Loading synthetic dataset from: {DATASET_PATH}")
    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset file not found at {DATASET_PATH}")
        sys.exit(1)

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    if not isinstance(raw_data, list):
        raise ValueError("Dataset root must be a list.")

    seen: set[str] = set()
    validated_items: list[dict[str, Any]] = []
    for index, item in enumerate(raw_data):
        validated = validate_example(item, index)
        key = validated["instruction"].lower()
        if key in seen:
            continue
        seen.add(key)
        validated_items.append(format_training_example(validated))

    random.Random(SEED).shuffle(validated_items)

    out_dir = os.path.dirname(OUTPUT_PATH)
    os.makedirs(out_dir, exist_ok=True)
    write_jsonl(OUTPUT_PATH, validated_items)

    n = len(validated_items)
    n_train = max(1, int(n * 0.8))
    n_val = max(1, int(n * 0.1)) if n > 2 else 1

    splits = {
        "train": validated_items[:n_train],
        "val": validated_items[n_train : n_train + n_val],
        "test": validated_items[n_train + n_val :] or validated_items[-1:],
    }

    for split_name, items in splits.items():
        split_path = os.path.join(out_dir, f"{split_name}.jsonl")
        write_jsonl(split_path, items)
        print(f"Saved {len(items)} examples to {split_path}")

    print(f"Successfully processed {len(validated_items)} validated examples.")


if __name__ == "__main__":
    main()
