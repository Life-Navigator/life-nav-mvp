#!/usr/bin/env python3
"""
Quick Integration Test - Verifies core components
"""

import asyncio
import httpx
import sys
from pathlib import Path

# Add mcp-server directory to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "mcp-server"))

GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


async def test_maverick():
    """Test Maverick LLM"""
    print(f"\n{BLUE}Testing Maverick LLM...{RESET}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Health check
            response = await client.get("http://localhost:8090/health")
            if response.status_code == 200:
                print(f"{GREEN}✓{RESET} Maverick health check passed")
            else:
                print(f"{RED}✗{RESET} Maverick health check failed: {response.status_code}")
                return False

            # Test simple completion
            response = await client.post(
                "http://localhost:8090/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Say: test"}],
                    "max_tokens": 10,
                    "temperature": 0.7
                },
                timeout=30.0
            )

            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                print(f"{GREEN}✓{RESET} Maverick completion works")
                print(f"  Response: {content[:100]}")
                return True
            else:
                print(f"{RED}✗{RESET} Maverick completion failed: {response.status_code}")
                print(f"  Error: {response.text[:200]}")
                return False

    except Exception as e:
        print(f"{RED}✗{RESET} Maverick test failed: {e}")
        return False


async def test_embeddings():
    """Test embedding generation"""
    print(f"\n{BLUE}Testing Embedding Generation...{RESET}")

    try:
        from ingestion.extractors import EmbeddingGenerator

        generator = EmbeddingGenerator(use_local=True)
        embeddings = await generator.generate_embeddings(["Test sentence"])

        if len(embeddings) > 0 and len(embeddings[0]) > 0:
            print(f"{GREEN}✓{RESET} Embeddings generated: dimension {len(embeddings[0])}")
            return True
        else:
            print(f"{RED}✗{RESET} No embeddings generated")
            return False

    except Exception as e:
        print(f"{RED}✗{RESET} Embedding test failed: {e}")
        return False


async def test_parsers():
    """Test document parsers"""
    print(f"\n{BLUE}Testing Document Parsers...{RESET}")

    try:
        from ingestion.parsers import ParserFactory

        # Test markdown
        test_file = Path("/tmp/test.md")
        test_file.write_text("# Test\nContent here")

        result = ParserFactory.parse_document(str(test_file))

        test_file.unlink()

        if result and result.get("text"):
            print(f"{GREEN}✓{RESET} Document parsing works")
            print(f"  Extracted {len(result['text'])} chars, {len(result['chunks'])} chunks")
            return True
        else:
            print(f"{RED}✗{RESET} Document parsing failed")
            return False

    except Exception as e:
        print(f"{RED}✗{RESET} Parser test failed: {e}")
        return False


async def main():
    """Run quick tests"""
    print(f"{BLUE}{'=' * 60}{RESET}")
    print(f"{BLUE}{'Quick Integration Test':^60}{RESET}")
    print(f"{BLUE}{'=' * 60}{RESET}")

    results = []

    # Test Maverick
    results.append(await test_maverick())

    # Test Embeddings
    results.append(await test_embeddings())

    # Test Parsers
    results.append(await test_parsers())

    # Summary
    print(f"\n{BLUE}{'=' * 60}{RESET}")
    passed = sum(results)
    total = len(results)

    if passed == total:
        print(f"{GREEN}All {total} tests passed!{RESET}")
        return 0
    else:
        print(f"{YELLOW}{passed}/{total} tests passed{RESET}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
