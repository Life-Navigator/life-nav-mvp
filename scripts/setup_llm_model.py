#!/usr/bin/env python3
"""
Download and Setup LLM Model for vLLM

This script:
1. Downloads the model from Hugging Face
2. Verifies the download
3. Updates configuration
4. Provides startup commands for vLLM

Model: meta-llama/Llama-4-Maverick-17B-128E
Architecture: Mixture of Experts (MoE) with 128 experts
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import Optional
import json

def print_banner():
    """Print setup banner"""
    print("\n" + "=" * 70)
    print("  🤖 LLM Model Setup - Llama-4-Maverick-17B-128E")
    print("=" * 70 + "\n")


def check_prerequisites():
    """Check if required packages are installed"""
    print("📋 Checking prerequisites...")

    required_packages = [
        "huggingface_hub",
        "torch",
        "transformers",
        "vllm"
    ]

    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✅ {package}")
        except ImportError:
            print(f"  ❌ {package} - MISSING")
            missing.append(package)

    if missing:
        print(f"\n⚠️  Missing packages: {', '.join(missing)}")
        print(f"\nInstall with:")
        print(f"  pip install {' '.join(missing)}")
        return False

    print("✅ All prerequisites installed!\n")
    return True


def check_hf_token():
    """Check if Hugging Face token is configured"""
    print("🔑 Checking Hugging Face authentication...")

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    if not token:
        print("  ⚠️  No HF_TOKEN found in environment")
        print("\n💡 To download gated models (like Llama), you need a token:")
        print("  1. Go to https://huggingface.co/settings/tokens")
        print("  2. Create a new token with 'read' access")
        print("  3. Export it: export HF_TOKEN='your-token-here'")
        print("  4. Or save in ~/.huggingface/token")

        proceed = input("\nDo you have access to the model and want to proceed? (y/n): ")
        if proceed.lower() != 'y':
            return False

        manual_token = input("Enter your HF token (or press Enter to skip): ").strip()
        if manual_token:
            os.environ["HF_TOKEN"] = manual_token
            print("  ✅ Token set for this session")
        else:
            print("  ⚠️  Proceeding without token (may fail for gated models)")
    else:
        print(f"  ✅ Token found: {token[:10]}...")

    return True


def get_model_cache_dir() -> Path:
    """Get the Hugging Face cache directory"""
    # Check if custom cache dir is set
    cache_dir = os.environ.get("HF_HOME") or os.environ.get("HUGGING_FACE_HUB_CACHE")

    if cache_dir:
        return Path(cache_dir)

    # Default Hugging Face cache location
    return Path.home() / ".cache" / "huggingface" / "hub"


def download_model(model_name: str, cache_dir: Optional[Path] = None):
    """Download model from Hugging Face"""
    from huggingface_hub import snapshot_download

    print(f"📥 Downloading model: {model_name}")
    print(f"   This may take a while (17B model is ~34GB)...\n")

    try:
        if cache_dir:
            os.environ["HF_HOME"] = str(cache_dir)

        # Download the model
        model_path = snapshot_download(
            repo_id=model_name,
            cache_dir=cache_dir,
            resume_download=True,  # Resume if interrupted
            token=os.environ.get("HF_TOKEN"),
            local_files_only=False
        )

        print(f"\n✅ Model downloaded successfully!")
        print(f"   Location: {model_path}")
        return model_path

    except Exception as e:
        print(f"\n❌ Download failed: {e}")
        print("\n💡 Troubleshooting:")
        print("  1. Check your HF_TOKEN is valid")
        print("  2. Ensure you have access to the model")
        print("  3. Check your internet connection")
        print("  4. Verify you have enough disk space (~40GB free)")
        return None


def verify_model(model_path: str):
    """Verify model files are present"""
    print(f"\n🔍 Verifying model files...")

    model_dir = Path(model_path)
    required_files = [
        "config.json",
        "tokenizer_config.json",
        # Model weights (might be split)
    ]

    found = []
    missing = []

    for file in required_files:
        file_path = model_dir / file
        if file_path.exists():
            found.append(file)
            print(f"  ✅ {file}")
        else:
            missing.append(file)
            print(f"  ❌ {file} - MISSING")

    # Check for model weights (various formats)
    weight_files = list(model_dir.glob("*.safetensors")) or \
                   list(model_dir.glob("*.bin")) or \
                   list(model_dir.glob("pytorch_model-*.bin"))

    if weight_files:
        print(f"  ✅ Model weights ({len(weight_files)} files)")
        total_size = sum(f.stat().st_size for f in weight_files)
        print(f"     Total size: {total_size / (1024**3):.2f} GB")
    else:
        print(f"  ❌ No model weight files found")
        missing.append("model weights")

    if not missing:
        print("\n✅ Model verification passed!")
        return True
    else:
        print(f"\n⚠️  Missing files: {', '.join(missing)}")
        return False


def update_env_file(model_name: str):
    """Update .env file with new model configuration"""
    print(f"\n📝 Updating .env configuration...")

    env_path = Path(__file__).parent.parent / ".env"
    env_example_path = Path(__file__).parent.parent / ".env.example"

    # Create .env from .env.example if it doesn't exist
    if not env_path.exists() and env_example_path.exists():
        print("  Creating .env from .env.example...")
        subprocess.run(["cp", str(env_example_path), str(env_path)])

    if not env_path.exists():
        print("  ⚠️  No .env file found, creating new one...")
        env_path.touch()

    # Read current .env
    with open(env_path, 'r') as f:
        lines = f.readlines()

    # Update VLLM_MODEL_NAME
    model_updated = False
    for i, line in enumerate(lines):
        if line.startswith('VLLM_MODEL_NAME='):
            lines[i] = f'VLLM_MODEL_NAME={model_name}\n'
            model_updated = True
            break

    # Add if not found
    if not model_updated:
        lines.append(f'\nVLLM_MODEL_NAME={model_name}\n')

    # Write back
    with open(env_path, 'w') as f:
        f.writelines(lines)

    print(f"  ✅ Updated VLLM_MODEL_NAME={model_name}")


def update_vllm_client(model_name: str):
    """Update vLLM client enum"""
    print(f"\n📝 Updating vLLM client configuration...")

    vllm_client_path = Path(__file__).parent.parent / "models" / "vllm_client.py"

    if not vllm_client_path.exists():
        print(f"  ⚠️  vLLM client not found at {vllm_client_path}")
        return

    # Read current file
    with open(vllm_client_path, 'r') as f:
        content = f.read()

    # Update the default model in LLMModel enum
    model_short_name = model_name.split('/')[-1]

    # Find and replace the enum
    old_enum_value = 'LLAMA_4_MAVERICK = "meta-llama/Llama-4-Maverick-70B-Instruct"'
    new_enum_value = f'LLAMA_4_MAVERICK = "{model_name}"'

    if old_enum_value in content:
        content = content.replace(old_enum_value, new_enum_value)
        with open(vllm_client_path, 'w') as f:
            f.write(content)
        print(f"  ✅ Updated LLMModel enum in vllm_client.py")
    else:
        print(f"  ℹ️  Manual update may be needed for vllm_client.py")


def generate_vllm_startup_command(model_name: str, model_path: str):
    """Generate vLLM server startup command"""
    print(f"\n🚀 vLLM Startup Commands:")
    print("=" * 70)

    # Instance 1 (port 8000)
    cmd1 = f"""
# Instance 1 (port 8000)
vllm serve {model_name} \\
  --host 0.0.0.0 \\
  --port 8000 \\
  --tensor-parallel-size 1 \\
  --dtype auto \\
  --max-model-len 32768 \\
  --gpu-memory-utilization 0.9 \\
  --enable-chunked-prefill \\
  --max-num-seqs 256 \\
  --trust-remote-code
"""

    # Instance 2 (port 8001) - for load balancing
    cmd2 = f"""
# Instance 2 (port 8001) - Optional for load balancing
vllm serve {model_name} \\
  --host 0.0.0.0 \\
  --port 8001 \\
  --tensor-parallel-size 1 \\
  --dtype auto \\
  --max-model-len 32768 \\
  --gpu-memory-utilization 0.9 \\
  --enable-chunked-prefill \\
  --max-num-seqs 256 \\
  --trust-remote-code
"""

    print(cmd1)
    print(cmd2)

    # Save to file
    script_path = Path(__file__).parent / "start_vllm.sh"
    with open(script_path, 'w') as f:
        f.write("#!/bin/bash\n")
        f.write("# vLLM Server Startup Script\n")
        f.write(f"# Model: {model_name}\n\n")
        f.write("# Start Instance 1\n")
        f.write(cmd1.strip() + " &\n\n")
        f.write("# Uncomment to start Instance 2 for load balancing\n")
        f.write("# " + cmd2.strip().replace("\n", "\n# ") + " &\n\n")
        f.write("wait\n")

    # Make executable
    os.chmod(script_path, 0o755)

    print(f"\n💾 Startup script saved to: {script_path}")
    print(f"\nRun with:")
    print(f"  bash {script_path}")


def generate_system_info():
    """Display system requirements and recommendations"""
    print("\n📊 System Requirements:")
    print("=" * 70)
    print("""
Model: Llama-4-Maverick-17B-128E (Mixture of Experts)
Architecture: 128 experts, ~17B active parameters

Minimum Requirements:
  • GPU: NVIDIA with 24GB VRAM (e.g., RTX 3090, A5000)
  • RAM: 64GB system memory
  • Disk: 40GB free space
  • CUDA: 11.8+ or 12.1+

Recommended Setup:
  • GPU: NVIDIA with 40GB+ VRAM (e.g., A100, H100)
  • RAM: 128GB system memory
  • Disk: 100GB free space (SSD preferred)
  • CUDA: 12.1+

For Multi-GPU:
  • Use --tensor-parallel-size <num_gpus>
  • Example: 2x A100 (80GB) = --tensor-parallel-size 2

Performance Tips:
  • Enable Flash Attention 2 (automatic in vLLM)
  • Use --gpu-memory-utilization 0.9 (90% GPU memory)
  • Increase --max-num-seqs for higher throughput
  • Use SSD for model cache (faster loading)
""")


def main():
    """Main setup workflow"""
    print_banner()

    # Model configuration
    MODEL_NAME = "meta-llama/Llama-4-Maverick-17B-128E"

    # Step 1: Check prerequisites
    if not check_prerequisites():
        print("\n❌ Setup aborted: Missing prerequisites")
        return 1

    # Step 2: Check HF authentication
    if not check_hf_token():
        print("\n❌ Setup aborted: Authentication required")
        return 1

    # Step 3: Display system info
    generate_system_info()

    proceed = input("\n➡️  Proceed with model download? (y/n): ")
    if proceed.lower() != 'y':
        print("\n⏹️  Setup cancelled by user")
        return 0

    # Step 4: Download model
    cache_dir = get_model_cache_dir()
    print(f"\n📂 Cache directory: {cache_dir}")

    model_path = download_model(MODEL_NAME, cache_dir)
    if not model_path:
        print("\n❌ Setup failed: Model download failed")
        return 1

    # Step 5: Verify model
    if not verify_model(model_path):
        print("\n⚠️  Model verification failed, but continuing...")

    # Step 6: Update configuration
    update_env_file(MODEL_NAME)
    update_vllm_client(MODEL_NAME)

    # Step 7: Generate startup commands
    generate_vllm_startup_command(MODEL_NAME, model_path)

    # Success!
    print("\n" + "=" * 70)
    print("  ✅ MODEL SETUP COMPLETE!")
    print("=" * 70)
    print(f"""
🎉 Successfully set up {MODEL_NAME}!

Next Steps:
1. Start vLLM server:
   bash scripts/start_vllm.sh

2. Test the model:
   python scripts/test_vllm_connection.py

3. Run the agent demo:
   python scripts/start_with_dashboard.py

📚 Documentation:
   • vLLM docs: https://docs.vllm.ai
   • Model card: https://huggingface.co/{MODEL_NAME}
   • Integration guide: docs/ADMIN_DASHBOARD_INTEGRATION.md
""")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
