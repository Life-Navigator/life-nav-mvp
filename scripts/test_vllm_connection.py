#!/usr/bin/env python3
"""
Test vLLM Connection and Model Inference

This script tests:
1. vLLM server is reachable
2. Model is loaded correctly
3. Inference is working
4. Performance metrics
"""

import asyncio
import sys
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.vllm_client import VLLMClient, Message
from utils.logging import get_logger

logger = get_logger("vllm_test")


def print_banner():
    """Print test banner"""
    print("\n" + "=" * 70)
    print("  🧪 vLLM Connection Test")
    print("=" * 70 + "\n")


async def test_health_check(client: VLLMClient):
    """Test health check endpoint"""
    print("📋 Test 1: Health Check")
    print("-" * 70)

    try:
        health = await client.health_check_all()

        for instance, status in health.items():
            status_icon = "✅" if status else "❌"
            print(f"  {status_icon} {instance}: {'healthy' if status else 'unhealthy'}")

        healthy_count = sum(1 for s in health.values() if s)
        print(f"\n  Result: {healthy_count}/{len(health)} instances healthy")

        return healthy_count > 0

    except Exception as e:
        print(f"  ❌ Health check failed: {e}")
        return False


async def test_simple_inference(client: VLLMClient):
    """Test simple inference"""
    print("\n📋 Test 2: Simple Inference")
    print("-" * 70)

    try:
        prompt = "What is 2+2? Answer in one word."
        print(f"  Prompt: {prompt}")

        start_time = time.time()
        response = await client.chat(prompt=prompt, temperature=0.0, max_tokens=10)
        latency = (time.time() - start_time) * 1000

        print(f"  Response: {response}")
        print(f"  Latency: {latency:.2f}ms")

        # Check if response makes sense
        if any(word in response.lower() for word in ['four', '4', 'four.']):
            print(f"  ✅ Response looks correct!")
            return True
        else:
            print(f"  ⚠️  Response may be incorrect")
            return False

    except Exception as e:
        print(f"  ❌ Inference failed: {e}")
        return False


async def test_chat_completion(client: VLLMClient):
    """Test chat completion with messages"""
    print("\n📋 Test 3: Chat Completion")
    print("-" * 70)

    try:
        messages = [
            Message(role="system", content="You are a helpful assistant."),
            Message(role="user", content="Explain what a multi-agent system is in one sentence.")
        ]

        print(f"  Messages: {len(messages)}")

        start_time = time.time()
        response = await client.complete(messages=messages, temperature=0.7, max_tokens=100)
        latency = (time.time() - start_time) * 1000

        print(f"  Response: {response.content[:200]}...")
        print(f"  Model: {response.model}")
        print(f"  Tokens: {response.tokens_used}")
        print(f"  Latency: {latency:.2f}ms")
        print(f"  Finish Reason: {response.finish_reason}")

        if response.content and len(response.content) > 20:
            print(f"  ✅ Chat completion successful!")
            return True
        else:
            print(f"  ⚠️  Response too short")
            return False

    except Exception as e:
        print(f"  ❌ Chat completion failed: {e}")
        return False


async def test_agent_intent_analysis(client: VLLMClient):
    """Test agent-style intent analysis"""
    print("\n📋 Test 4: Agent Intent Analysis")
    print("-" * 70)

    try:
        system_prompt = """You are an intent classifier for a personal assistant.
Classify the user's intent into one of: budget_analysis, job_search, skill_development, general_query.
Respond with ONLY the intent name."""

        user_query = "How much money did I spend on groceries last month?"

        print(f"  User Query: {user_query}")

        start_time = time.time()
        response = await client.chat(
            prompt=user_query,
            system_prompt=system_prompt,
            temperature=0.0,
            max_tokens=50
        )
        latency = (time.time() - start_time) * 1000

        print(f"  Classified Intent: {response}")
        print(f"  Latency: {latency:.2f}ms")

        if "budget" in response.lower():
            print(f"  ✅ Intent classification correct!")
            return True
        else:
            print(f"  ⚠️  Intent classification may be incorrect")
            return False

    except Exception as e:
        print(f"  ❌ Intent analysis failed: {e}")
        return False


async def test_performance_batch(client: VLLMClient):
    """Test performance with multiple requests"""
    print("\n📋 Test 5: Performance (10 requests)")
    print("-" * 70)

    try:
        prompts = [
            "Count from 1 to 5.",
            "What is the capital of France?",
            "Name three programming languages.",
            "What is 10 + 20?",
            "Name a color.",
            "What day comes after Monday?",
            "Is water wet?",
            "Name a fruit.",
            "What is 5 * 5?",
            "Name a planet."
        ]

        print(f"  Running {len(prompts)} requests...")

        latencies = []
        successful = 0

        for i, prompt in enumerate(prompts, 1):
            try:
                start_time = time.time()
                response = await client.chat(prompt=prompt, temperature=0.7, max_tokens=50)
                latency = (time.time() - start_time) * 1000

                latencies.append(latency)
                successful += 1

                print(f"  [{i}/{len(prompts)}] {latency:.0f}ms - {response[:50]}...")

            except Exception as e:
                print(f"  [{i}/{len(prompts)}] Failed: {e}")

        if latencies:
            avg_latency = sum(latencies) / len(latencies)
            min_latency = min(latencies)
            max_latency = max(latencies)
            p95_latency = sorted(latencies)[int(len(latencies) * 0.95)]

            print(f"\n  Performance Metrics:")
            print(f"    Successful: {successful}/{len(prompts)}")
            print(f"    Avg Latency: {avg_latency:.2f}ms")
            print(f"    Min Latency: {min_latency:.2f}ms")
            print(f"    Max Latency: {max_latency:.2f}ms")
            print(f"    P95 Latency: {p95_latency:.2f}ms")

            print(f"  ✅ Performance test complete!")
            return True
        else:
            print(f"  ❌ No successful requests")
            return False

    except Exception as e:
        print(f"  ❌ Performance test failed: {e}")
        return False


async def test_client_stats(client: VLLMClient):
    """Display client statistics"""
    print("\n📊 Client Statistics")
    print("-" * 70)

    try:
        stats = client.get_stats()

        print(f"  Instances: {stats['instances']}")
        print(f"  Healthy: {stats['healthy_instances']}")
        print(f"  Total Requests: {stats['total_requests']}")
        print(f"  Cache Size: {stats['cache_size']}")

        print(f"\n  Instance Details:")
        for instance in client.instances:
            health = "✅" if stats['instance_health'][instance] else "❌"
            latency = stats['instance_latency'][instance]
            requests = stats['instance_requests'][instance]

            print(f"    {health} {instance}")
            print(f"       Latency: {latency:.2f}ms")
            print(f"       Requests: {requests}")

        return True

    except Exception as e:
        print(f"  ❌ Stats retrieval failed: {e}")
        return False


async def main():
    """Main test workflow"""
    print_banner()

    # Create vLLM client
    print("🔧 Initializing vLLM client...")

    try:
        client = VLLMClient()
        await client.connect()
        print("  ✅ Client initialized\n")
    except Exception as e:
        print(f"  ❌ Client initialization failed: {e}")
        print("\n💡 Make sure vLLM server is running:")
        print("  bash scripts/start_vllm.sh")
        return 1

    # Run tests
    results = {
        "Health Check": False,
        "Simple Inference": False,
        "Chat Completion": False,
        "Intent Analysis": False,
        "Performance": False,
        "Stats": False
    }

    try:
        results["Health Check"] = await test_health_check(client)

        if not results["Health Check"]:
            print("\n⚠️  Health check failed, but continuing tests...")

        results["Simple Inference"] = await test_simple_inference(client)
        results["Chat Completion"] = await test_chat_completion(client)
        results["Intent Analysis"] = await test_agent_intent_analysis(client)
        results["Performance"] = await test_performance_batch(client)
        results["Stats"] = await test_client_stats(client)

    finally:
        await client.disconnect()

    # Summary
    print("\n" + "=" * 70)
    print("  📊 TEST SUMMARY")
    print("=" * 70)

    passed = sum(1 for r in results.values() if r)
    total = len(results)

    for test_name, result in results.items():
        icon = "✅" if result else "❌"
        print(f"  {icon} {test_name}")

    print(f"\n  Result: {passed}/{total} tests passed")

    if passed == total:
        print("\n  🎉 All tests passed! vLLM is ready for production!")
        return 0
    elif passed >= total * 0.5:
        print("\n  ⚠️  Some tests failed, but basic functionality works")
        return 0
    else:
        print("\n  ❌ Most tests failed. Check vLLM server logs")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
