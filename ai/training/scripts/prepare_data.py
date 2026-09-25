import json
import os
import sys

DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "synthetic_dataset.json")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "dataset", "formatted_dataset.jsonl")


def format_training_example(example: dict) -> dict:
    """Format an instruction-output pair into chat completion format for SFT training."""
    instruction = example.get("instruction", "")
    output_obj = example.get("output", {})
    output_str = json.dumps(output_obj, indent=2)

    return {
        "messages": [
            {
                "role": "system",
                "content": "You are a DataPilot specialized AI. Convert the user data requirement into a valid JSON workflow specification."
            },
            {
                "role": "user",
                "content": instruction
            },
            {
                "role": "assistant",
                "content": output_str
            }
        ]
    }


def main():
    print(f"Loading synthetic dataset from: {DATASET_PATH}")
    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset file not found at {DATASET_PATH}")
        sys.exit(1)

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    formatted_items = [format_training_example(item) for item in data]

    out_dir = os.path.dirname(OUTPUT_PATH)
    os.makedirs(out_dir, exist_ok=True)
    
    # Save full formatted dataset
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for item in formatted_items:
            f.write(json.dumps(item) + "\n")

    # Save train/val/test splits (80% train, 10% val, 10% test split ratio)
    n = len(formatted_items)
    n_train = max(1, int(n * 0.8))
    n_val = max(1, int(n * 0.1)) if n > 2 else 1

    train_items = formatted_items[:n_train]
    val_items = formatted_items[n_train:n_train+n_val]
    test_items = formatted_items[n_train+n_val:] or formatted_items[-1:]

    for split_name, items in [("train", train_items), ("val", val_items), ("test", test_items)]:
        split_path = os.path.join(out_dir, f"{split_name}.jsonl")
        with open(split_path, "w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item) + "\n")
        print(f"Saved {len(items)} examples to {split_path}")

    print(f"Successfully processed {len(formatted_items)} total examples.")



if __name__ == "__main__":
    main()
