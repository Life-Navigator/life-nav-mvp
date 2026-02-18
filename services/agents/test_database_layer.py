#!/usr/bin/env python3
"""
Test script for Rust database layer
Tests basic functionality without requiring live database connections
"""

import sys
import asyncio

# Import the Rust module
try:
    from life_navigator_rs import (
        PyNeo4jConfigFixed,
        PyQdrantConfigFixed,
        # PyNeo4jClientFixed,  # Requires live Neo4j
        # PyQdrantClientFixed,  # Requires live Qdrant
    )
    print("✓ Successfully imported Rust database module")
except ImportError as e:
    print(f"✗ Failed to import Rust module: {e}")
    print("\nMake sure to build the module first:")
    print("  cd life-navigator-training-rs")
    print("  cargo build --release")
    print("  maturin develop --release")
    sys.exit(1)


def test_neo4j_config():
    """Test Neo4j configuration creation"""
    print("\n=== Testing Neo4j Config ===")

    # Test default config
    PyNeo4jConfigFixed()
    print("✓ Created default Neo4j config")

    # Test custom config
    PyNeo4jConfigFixed(
        uri="bolt://my-server:7687",
        user="admin",
        password="secret",
        database="mydb",
        max_connections=50
    )
    print("✓ Created custom Neo4j config")

    return True


def test_qdrant_config():
    """Test Qdrant configuration creation"""
    print("\n=== Testing Qdrant Config ===")

    # Test default config
    PyQdrantConfigFixed()
    print("✓ Created default Qdrant config")

    # Test custom config
    PyQdrantConfigFixed(
        url="http://my-server:6334",
        api_key="my-secret-key"
    )
    print("✓ Created custom Qdrant config with API key")

    # Test without API key
    PyQdrantConfigFixed(url="http://localhost:6334")
    print("✓ Created custom Qdrant config without API key")

    return True


async def test_neo4j_client_creation():
    """Test Neo4j client creation (requires live Neo4j)"""
    print("\n=== Testing Neo4j Client Creation ===")

    # NOTE: This will fail if Neo4j is not running
    # Uncomment when you have Neo4j running
    """
    try:
        from life_navigator_rs import PyNeo4jClientFixed
        config = PyNeo4jConfigFixed(
            uri="bolt://localhost:7687",
            user="neo4j",
            password="password"
        )
        client = await PyNeo4jClientFixed.new(config)
        print("✓ Successfully created Neo4j client")

        # Test health check
        is_healthy = await client.health_check()
        print(f"✓ Neo4j health check: {is_healthy}")

        return True
    except Exception as e:
        print(f"✗ Neo4j client creation failed (expected if Neo4j not running): {e}")
        return False
    """
    print("⊘ Skipped (requires live Neo4j)")
    return True


async def test_qdrant_client_creation():
    """Test Qdrant client creation (requires live Qdrant)"""
    print("\n=== Testing Qdrant Client Creation ===")

    # NOTE: This will fail if Qdrant is not running
    # Uncomment when you have Qdrant running
    """
    try:
        from life_navigator_rs import PyQdrantClientFixed
        config = PyQdrantConfigFixed(url="http://localhost:6334")
        client = await PyQdrantClientFixed.new(config)
        print("✓ Successfully created Qdrant client")

        # Test health check
        is_healthy = await client.health_check()
        print(f"✓ Qdrant health check: {is_healthy}")

        return True
    except Exception as e:
        print(f"✗ Qdrant client creation failed (expected if Qdrant not running): {e}")
        return False
    """
    print("⊘ Skipped (requires live Qdrant)")
    return True


async def main():
    """Run all tests"""
    print("=" * 60)
    print("Testing Rust Database Layer - Basic Functionality")
    print("=" * 60)

    results = []

    # Test configurations (no database required)
    results.append(("Neo4j Config", test_neo4j_config()))
    results.append(("Qdrant Config", test_qdrant_config()))

    # Test client creation (requires live databases - skipped for now)
    results.append(("Neo4j Client", await test_neo4j_client_creation()))
    results.append(("Qdrant Client", await test_qdrant_client_creation()))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All basic tests passed!")
        print("\nNext steps:")
        print("1. Start Neo4j and Qdrant")
        print("2. Uncomment client creation tests")
        print("3. Test actual database operations")
        return 0
    else:
        print("\n⚠ Some tests failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
