#!/usr/bin/env python3
"""
Quantize Maverick FP16 to 8-bit INT8 for DGX Spark
Target: ~374GB (will work with memory mapping)

Uses bitsandbytes for proper 8-bit quantization of large language models
"""

import os
import json
import torch
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# Paths
FP16_MODEL = Path("/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16")
INT8_MODEL = Path("/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-int8")

def quantize_to_int8():
    print("🔄 Quantizing Maverick FP16 → INT8 (bitsandbytes)")
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

    # Configure 8-bit quantization
    print()
    print("🔧 Configuring 8-bit quantization...")
    quantization_config = BitsAndBytesConfig(
        load_in_8bit=True,
        llm_int8_threshold=6.0,
        llm_int8_has_fp16_weight=False,
    )
    print("✓ Quantization config ready")

    # Load model with 8-bit quantization
    print()
    print("🔄 Loading and quantizing model (this will take time)...")
    print("   Using bitsandbytes for memory-efficient 8-bit quantization")

    try:
        # Load model with 8-bit quantization
        model = AutoModelForCausalLM.from_pretrained(
            FP16_MODEL,
            quantization_config=quantization_config,
            device_map="auto",
            low_cpu_mem_usage=True,
            trust_remote_code=True
        )

        print("✓ Model loaded and quantized to INT8")
        print()
        print("💾 Saving INT8 model...")

        # Save quantized model
        model.save_pretrained(
            INT8_MODEL,
            safe_serialization=True,
            max_shard_size="10GB"
        )

        # Copy config and update
        print("📝 Updating config...")
        with open(FP16_MODEL / "config.json") as f:
            config = json.load(f)

        # Add quantization config to model config
        config["quantization_config"] = {
            "load_in_8bit": True,
            "llm_int8_threshold": 6.0,
            "llm_int8_has_fp16_weight": False,
            "bnb_4bit_compute_dtype": "float16",
            "bnb_4bit_use_double_quant": False,
            "bnb_4bit_quant_type": "nf4"
        }

        with open(INT8_MODEL / "config.json", 'w') as f:
            json.dump(config, f, indent=2)
        print("✓ Config updated")

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
        print("Note: When loading with vLLM, use --quantization=bitsandbytes flag")
        print()

    except Exception as e:
        print(f"❌ Error during quantization: {e}")
        print()
        print("Note: This model is very large. If you run out of memory,")
        print("try the 4-bit AWQ quantization instead for better memory efficiency.")
        import traceback
        traceback.print_exc()
        return False

    return True

if __name__ == "__main__":
    success = quantize_to_int8()
    exit(0 if success else 1)
