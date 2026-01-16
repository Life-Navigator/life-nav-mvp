#!/usr/bin/env python3
"""
Test Vertex AI Gemini Integration

Quick test script to verify Vertex AI is properly configured.
"""

import os
import sys
import asyncio
from pathlib import Path

# Add services to path
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "agents"))
sys.path.insert(0, str(Path(__file__).parent.parent / "services" / "api" / "app"))

async def test_gemini_client():
    """Test the Gemini client"""
    print("=" * 60)
    print("Testing Vertex AI Gemini Client")
    print("=" * 60)
    print()

    # Check environment
    project_id = os.getenv("GCP_PROJECT_ID")
    credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not project_id:
        print("❌ Error: GCP_PROJECT_ID not set")
        return False

    if not credentials:
        print("❌ Error: GOOGLE_APPLICATION_CREDENTIALS not set")
        return False

    print(f"✓ Project ID: {project_id}")
    print(f"✓ Credentials: {credentials}")
    print()

    # Test agent system client
    print("Testing agent system Gemini client...")
    try:
        from models.gemini_client import GeminiClient

        async with GeminiClient(project_id=project_id) as client:
            # Test 1: Simple chat
            print("\n[Test 1] Simple chat...")
            response = await client.chat(
                prompt="What is 2+2? Respond with just the number.",
                temperature=0.0,
                max_tokens=10
            )
            print(f"Response: {response}")

            # Test 2: System prompt
            print("\n[Test 2] System prompt...")
            response = await client.chat(
                prompt="What is your purpose?",
                system_prompt="You are a helpful financial advisor.",
                temperature=0.7,
                max_tokens=50
            )
            print(f"Response: {response[:100]}...")

            # Test 3: Intent classification (agent use case)
            print("\n[Test 3] Intent classification...")
            response = await client.chat(
                prompt='User says: "Help me create a budget". Classify intent: budget_analysis, savings_planning, or investment_advice',
                system_prompt="You are an intent classifier. Respond with ONLY the intent name.",
                temperature=0.1,
                max_tokens=20
            )
            print(f"Intent: {response}")

            # Get stats
            stats = client.get_stats()
            print("\n" + "=" * 60)
            print("Client Statistics:")
            print("=" * 60)
            print(f"Total requests: {stats['total_requests']}")
            print(f"Total tokens: {stats['total_tokens']}")
            print(f"Total cost: ${stats['total_cost_usd']:.6f}")
            print(f"Cache hits: {stats['cache_size']}")

        print("\n✅ Agent system client: PASSED")
        return True

    except Exception as e:
        print(f"\n❌ Agent system client FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_embeddings():
    """Test Vertex AI embeddings"""
    print("\n" + "=" * 60)
    print("Testing Vertex AI Embeddings")
    print("=" * 60)
    print()

    try:
        from services.vertex_embeddings import VertexEmbeddingProvider

        provider = VertexEmbeddingProvider()

        # Test single embedding
        print("[Test 1] Single embedding...")
        embedding = await provider.generate_embedding(
            text="Life Navigator helps you plan your financial future",
            task_type="RETRIEVAL_DOCUMENT"
        )
        print(f"Embedding dimension: {len(embedding)}")
        print(f"First 5 values: {embedding[:5]}")

        # Test batch embeddings
        print("\n[Test 2] Batch embeddings...")
        texts = [
            "Create a budget",
            "Plan for retirement",
            "Invest in stocks",
            "Pay off debt",
            "Build emergency fund"
        ]
        embeddings = await provider.generate_embeddings(
            texts=texts,
            task_type="RETRIEVAL_DOCUMENT"
        )
        print(f"Generated {len(embeddings)} embeddings")

        # Get stats
        stats = provider.get_stats()
        print("\n" + "=" * 60)
        print("Embedding Statistics:")
        print("=" * 60)
        print(f"Total tokens: {stats['total_tokens']}")
        print(f"Total cost: ${stats['total_cost_usd']:.6f}")

        print("\n✅ Embeddings: PASSED")
        return True

    except Exception as e:
        print(f"\n❌ Embeddings FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_health_check():
    """Test health check"""
    print("\n" + "=" * 60)
    print("Testing Health Check")
    print("=" * 60)
    print()

    try:
        from models.gemini_client import get_gemini_client

        client = await get_gemini_client()
        is_healthy = await client.health_check("dummy-url")  # URL ignored

        if is_healthy:
            print("✅ Health check: PASSED")
            return True
        else:
            print("❌ Health check: FAILED")
            return False

    except Exception as e:
        print(f"❌ Health check FAILED: {e}")
        return False


async def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print(" " * 20 + "VERTEX AI INTEGRATION TEST SUITE")
    print("=" * 80)
    print()

    results = []

    # Test 1: Gemini client
    results.append(await test_gemini_client())

    # Test 2: Embeddings
    results.append(await test_embeddings())

    # Test 3: Health check
    results.append(await test_health_check())

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    print(f"\nPassed: {passed}/{total}")

    if passed == total:
        print("\n🎉 All tests PASSED! Vertex AI is ready for production.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) FAILED. Please check configuration.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
