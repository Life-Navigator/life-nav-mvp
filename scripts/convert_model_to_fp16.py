#!/usr/bin/env python3
"""
Convert Llama-4-Maverick model from bfloat16 to float16 (fp16)
This will convert all 749GB of safetensors files.
"""

import os
import json
import shutil
from pathlib import Path
from safetensors.torch import load_file, save_file
import torch
from tqdm import tqdm

# Paths
SOURCE_MODEL = Path("/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix")
TARGET_MODEL = Path("/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16")

def convert_safetensors_to_fp16(source_path: Path, target_path: Path):
    """Convert a safetensors file from bfloat16 to float16."""
    print(f"Converting {source_path.name}...")

    # Load tensors
    tensors = load_file(str(source_path))

    # Convert all tensors to fp16
    fp16_tensors = {}
    for key, tensor in tensors.items():
        if tensor.dtype == torch.bfloat16:
            fp16_tensors[key] = tensor.to(torch.float16)
        elif tensor.dtype == torch.float32:
            fp16_tensors[key] = tensor.to(torch.float16)
        else:
            # Keep other dtypes as-is (int, etc.)
            fp16_tensors[key] = tensor

    # Save as fp16
    save_file(fp16_tensors, str(target_path))
    print(f"✓ Saved {target_path.name}")

def main():
    print("🔄 Converting Llama-4-Maverick from bfloat16 to fp16")
    print("=" * 60)
    print(f"Source: {SOURCE_MODEL}")
    print(f"Target: {TARGET_MODEL}")
    print("=" * 60)

    # Create target directory
    TARGET_MODEL.mkdir(parents=True, exist_ok=True)

    # Get all safetensors files (55 shards)
    safetensors_files = sorted(SOURCE_MODEL.glob("model-*.safetensors"))
    print(f"\nFound {len(safetensors_files)} safetensors files to convert")

    # Check disk space
    source_size_gb = sum(f.stat().st_size for f in safetensors_files) / (1024**3)
    print(f"Total size: {source_size_gb:.1f} GB")
    print(f"\nThis will take approximately 2-4 hours depending on disk I/O speed.")
    print("Press Ctrl+C within 5 seconds to cancel...")

    import time
    try:
        time.sleep(5)
    except KeyboardInterrupt:
        print("\n❌ Cancelled by user")
        return

    # Convert each safetensors file
    print("\n🚀 Starting conversion...\n")
    for i, source_file in enumerate(safetensors_files, 1):
        target_file = TARGET_MODEL / source_file.name

        # Skip if already converted
        if target_file.exists():
            print(f"[{i}/{len(safetensors_files)}] ⏭️  Skipping {source_file.name} (already exists)")
            continue

        print(f"[{i}/{len(safetensors_files)}] Converting {source_file.name}...")
        try:
            convert_safetensors_to_fp16(source_file, target_file)
        except Exception as e:
            print(f"❌ Error converting {source_file.name}: {e}")
            return

    # Copy config files and update torch_dtype
    print("\n📝 Copying and updating config files...")

    # Copy and update config.json
    config_path = SOURCE_MODEL / "config.json"
    with open(config_path) as f:
        config = json.load(f)

    # Update dtype to float16
    config["torch_dtype"] = "float16"
    if "text_config" in config:
        config["text_config"]["torch_dtype"] = "float16"

    target_config = TARGET_MODEL / "config.json"
    with open(target_config, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"✓ Updated config.json (torch_dtype: float16)")

    # Copy other necessary files
    files_to_copy = [
        "generation_config.json",
        "model.safetensors.index.json",
        "preprocessor_config.json",
        "processor_config.json",
        "special_tokens_map.json",
        "tokenizer_config.json",
        "tokenizer.json",
        "tokenizer.model"
    ]

    for filename in files_to_copy:
        source = SOURCE_MODEL / filename
        if source.exists():
            shutil.copy2(source, TARGET_MODEL / filename)
            print(f"✓ Copied {filename}")

    print("\n" + "=" * 60)
    print("✅ Conversion complete!")
    print("=" * 60)
    print(f"\nFP16 model saved to: {TARGET_MODEL}")
    print(f"\nTo use with vLLM:")
    print(f'VLLM_MODEL="{TARGET_MODEL}" ./scripts/dev/start-vllm-server.sh')
    print()

if __name__ == "__main__":
    main()
