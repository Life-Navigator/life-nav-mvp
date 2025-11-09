# Quick vLLM Start

## Start vLLM Server (Single GPU)

```bash
./scripts/dev/start-vllm-server.sh
```

Wait 30-60 seconds for model to load.

## Test It Works

```bash
curl http://localhost:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "Hello, how are you?"}],
    "max_tokens": 100
  }'
```

## Use Different Model

```bash
VLLM_MODEL="meta-llama/Llama-3.1-8B-Instruct" ./scripts/dev/start-vllm-server.sh
```

## Multi-GPU (DGX)

```bash
TENSOR_PARALLEL_SIZE=4 ./scripts/dev/start-vllm-server.sh
```

## Check Logs

```bash
tail -f /tmp/vllm-server.log
```

That's it! vLLM is now serving at http://localhost:8090
