#!/usr/bin/env python3
"""
Quantize Maverick FP16 to 8-bit INT8 for DGX Spark
Target: ~374GB (will work with memory mapping)

Uses memory-mapped files so model doesn't need to fit in RAM
"""

import os
import json
import torch
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer
from tqdm import tqdm

# Paths
FP16_MODEL = Path("/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16")
INT8_MODEL = Path("/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-int8")

def quantize_to_int8():
    print("🔄 Quantizing Maverick FP16 → INT8")
    print("=" * 60)
    print(f"Source: {FP16_MODEL}")
    print(f"Target: {INT8_MODEL}")
    print()

    # Create output directory
    INT8_MODEL.mkdir(parents=True, exist_ok=True)

    # Load tokenizer (small, no quantization needed)
    print("📝 Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(FP16_MODEL)
    tokenizer.save_pretrained(INT8_MODEL)
    print("✓ Tokenizer saved")

    # Copy config and update dtype
    print("📝 Updating config...")
    with open(FP16_MODEL / "config.json") as f:
        config = json.load(f)

    config["torch_dtype"] = "int8"
    if "text_config" in config:
        config["text_config"]["torch_dtype"] = "int8"

    with open(INT8_MODEL / "config.json", 'w') as f:
        json.dump(config, f, indent=2)
    print("✓ Config updated")

    # Load and quantize model with low memory mode
    print()
    print("🔄 Loading model (this will take time)...")
    print("   Using low_cpu_mem_usage and device_map for memory efficiency")

    try:
        # Load with memory mapping and auto device placement
        model = AutoModelForCausalLM.from_pretrained(
            FP16_MODEL,
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True,
            device_map="auto",
        )

        print("✓ Model loaded")
        print()
        print("🔄 Quantizing to INT8...")

        # Quantize to INT8
        model = torch.quantization.quantize_dynamic(
            model,
            {torch.nn.Linear},
            dtype=torch.qint8
        )

        print("✓ Quantization complete")
        print()
        print("💾 Saving INT8 model...")

        # Save quantized model
        model.save_pretrained(
            INT8_MODEL,
            safe_serialization=True,
            max_shard_size="10GB"
        )

        print()
        print("=" * 60)
        print("✅ INT8 Quantization Complete!")
        print("=" * 60)
        print()
        print(f"Model saved to: {INT8_MODEL}")
        print(f"Estimated size: ~374GB")
        print()
        print("To use with vLLM:")
        print(f'VLLM_MODEL="{INT8_MODEL}" ./scripts/dev/start-vllm-server.sh')
        print()

    except Exception as e:
        print(f"❌ Error during quantization: {e}")
        print()
        print("Note: This model is very large. If you run out of memory,")
        print("try the 4-bit AWQ quantization instead for better memory efficiency.")
        return False

    return True

if __name__ == "__main__":
    success = quantize_to_int8()
    exit(0 if success else 1)
