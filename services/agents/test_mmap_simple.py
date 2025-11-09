#!/usr/bin/env python3
"""
Simple Memory-Mapped Graph Test
================================

Tests the basic functionality of memory-mapped graphs.
"""

import time
import os
from life_navigator_rs import MmapGraph

def test_basic_functionality():
    """Test basic create, open, and query operations"""
    print("\n" + "=" * 100)
    print(" " * 30 + "🗄️  MEMORY-MAPPED GRAPH TEST 🗄️")
    print("=" * 100)
    print()

    # Create a small test graph
    print("📝 Creating test graph...")
    node_index = {
        "Alice": 0,
        "Bob": 1,
        "Charlie": 2,
        "David": 3,
        "Eve": 4,
    }

    adjacency = [
        [(1, 1.0), (2, 0.5)],      # Alice -> Bob, Charlie
        [(2, 2.0), (3, 1.5)],       # Bob -> Charlie, David
        [(3, 0.8)],                 # Charlie -> David
        [(4, 1.2)],                 # David -> Eve
        [],                         # Eve -> nobody
    ]

    path = "/tmp/test_mmap_graph.bin"

    # Create the memory-mapped graph
    print(f"   Creating graph at {path}...")
    MmapGraph.create(path, node_index, adjacency)
    file_size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"   ✓ Created! File size: {file_size_mb:.4f} MB")

    # Open the graph
    print("\n📂 Opening memory-mapped graph...")
    start = time.perf_counter()
    graph = MmapGraph.open(path)
    open_time = (time.perf_counter() - start) * 1000
    print(f"   ✓ Opened in {open_time:.3f}ms")
    print(f"   ✓ {graph}")

    # Test queries
    print("\n🔍 Testing neighbor queries...")
    print(f"{'─' * 100}")

    test_queries = [
        ("Alice", "Alice"),
        ("Bob", "Bob"),
        ("Charlie", "Charlie"),
        ("David", "David"),
        ("Eve", "Eve"),
    ]

    for node_name, node_id in test_queries:
        idx = graph.get_index(node_id)
        if idx is not None:
            neighbors = graph.neighbors(idx)
            neighbor_names = [f"node_{n[0]} (weight={n[1]})" for n in neighbors]
            print(f"   {node_name:<10} → {neighbor_names if neighbors else 'no neighbors'}")

    # Test neighbor access by ID
    print("\n🔍 Testing neighbor queries by ID...")
    print(f"{'─' * 100}")

    alice_neighbors = graph.neighbors_by_id("Alice")
    print(f"   Alice's neighbors: {alice_neighbors}")

    bob_neighbors = graph.neighbors_by_id("Bob")
    print(f"   Bob's neighbors: {bob_neighbors}")

    # Performance test
    print("\n⚡ Performance Test (1000 queries)...")
    print(f"{'─' * 100}")

    times = []
    for _ in range(1000):
        start = time.perf_counter()
        neighbors = graph.neighbors(0)  # Query Alice's neighbors
        elapsed = (time.perf_counter() - start) * 1_000_000  # microseconds
        times.append(elapsed)

    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)

    print(f"   Average: {avg_time:.3f}μs")
    print(f"   Min: {min_time:.3f}μs")
    print(f"   Max: {max_time:.3f}μs")

    # Statistics
    print("\n📊 Graph Statistics:")
    print(f"{'─' * 100}")
    print(f"   Nodes: {graph.node_count()}")
    print(f"   Edges: {graph.edge_count()}")
    print(f"   File size: {graph.file_size() / 1024:.2f} KB")
    print(f"   Memory usage estimate: {graph.memory_usage_estimate() / 1024:.2f} KB")

    # Cleanup
    os.remove(path)
    print(f"\n✓ Cleaned up {path}")

    print("\n" + "=" * 100)
    print("✅ ALL TESTS PASSED!")
    print("=" * 100)
    print()

def test_scalability():
    """Test with larger graphs"""
    print("\n" + "=" * 100)
    print(" " * 25 + "📈 SCALABILITY TEST - Growing Graphs")
    print("=" * 100)
    print()

    sizes = [100, 500, 1000, 5000, 10000]

    for n_nodes in sizes:
        print(f"\n📊 Testing {n_nodes}-node graph...")

        # Create graph data
        node_index = {f"node_{i}": i for i in range(n_nodes)}

        # Ring topology with some random edges
        adjacency = []
        import random
        random.seed(42)

        for i in range(n_nodes):
            neighbors = []
            # Ring edge
            neighbors.append(((i + 1) % n_nodes, 1.0))
            # Random shortcuts (10% probability)
            if random.random() < 0.1:
                target = random.randint(0, n_nodes - 1)
                if target != i and target != (i + 1) % n_nodes:
                    neighbors.append((target, random.uniform(0.5, 2.0)))
            adjacency.append(neighbors)

        path = f"/tmp/test_graph_{n_nodes}.bin"

        # Create
        start = time.time()
        MmapGraph.create(path, node_index, adjacency)
        create_time = time.time() - start

        # Open
        start = time.time()
        graph = MmapGraph.open(path)
        open_time = time.time() - start

        # Query
        times = []
        for i in range(min(100, n_nodes)):
            start = time.perf_counter()
            neighbors = graph.neighbors(i)
            elapsed = (time.perf_counter() - start) * 1_000_000
            times.append(elapsed)

        avg_query_us = sum(times) / len(times)
        file_size_mb = graph.file_size() / (1024 * 1024)

        print(f"   Create: {create_time:.3f}s | Open: {open_time:.6f}s | "
              f"Query: {avg_query_us:.2f}μs | Size: {file_size_mb:.2f}MB")

        os.remove(path)

    print("\n" + "=" * 100)
    print("✅ SCALABILITY TEST COMPLETE!")
    print("=" * 100)
    print()

if __name__ == "__main__":
    test_basic_functionality()
    test_scalability()
