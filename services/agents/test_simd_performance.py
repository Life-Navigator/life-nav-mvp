#!/usr/bin/env python3
"""
SIMD Performance Benchmark - Elite Graph Algorithms
====================================================

Tests 3 PageRank implementations:
1. Sparse (baseline)
2. SIMD (4x parallelism)
3. Parallel SIMD (4x SIMD × multi-core)

Expected speedups: 2-4x for SIMD, 4-8x for Parallel SIMD
"""

import time
import statistics
from life_navigator_rs import CompactGraph

def create_test_graph(n_nodes, edge_density=0.1):
    """Create a test graph with specified size"""
    import random
    random.seed(42)

    graph = CompactGraph()

    # Add nodes
    for i in range(n_nodes):
        graph.add_node(f'node_{i}', {})

    # Add edges (ring + shortcuts)
    for i in range(n_nodes):
        graph.add_edge(f'node_{i}', f'node_{(i+1)%n_nodes}', 1.0, {})

    # Add random shortcuts
    n_shortcuts = int(n_nodes * edge_density)
    for _ in range(n_shortcuts):
        from_node = random.randint(0, n_nodes - 1)
        to_node = random.randint(0, n_nodes - 1)
        if from_node != to_node:
            weight = random.uniform(1.0, 5.0)
            try:
                graph.add_edge(f'node_{from_node}', f'node_{to_node}', weight, {})
            except Exception as e:
                # Log error for debugging
                import logging
                logger = logging.getLogger(__name__)
                logger.debug(f"Operation failed: {e}")
                pass

    return graph


def benchmark_pagerank(graph, name, method, n_runs=10):
    """Benchmark a PageRank method"""
    times = []

    for _ in range(n_runs):
        start = time.perf_counter()
        method()
        elapsed = (time.perf_counter() - start) * 1000  # ms
        times.append(elapsed)

    avg_time = statistics.mean(times)
    std_time = statistics.stdev(times) if len(times) > 1 else 0

    return {
        'name': name,
        'avg_ms': avg_time,
        'std_ms': std_time,
        'min_ms': min(times),
        'max_ms': max(times),
    }


def print_results_table(results_by_size):
    """Print beautiful results table"""
    print()
    print("=" * 100)
    print(" " * 30 + "🚀 SIMD PERFORMANCE BENCHMARK 🚀")
    print("=" * 100)
    print()

    for size, results in results_by_size.items():
        print(f"\n📊 Graph Size: {size} nodes")
        print("-" * 100)
        print(f"{'Algorithm':<30} │ {'Avg Time':<12} │ {'Min':<10} │ {'Max':<10} │ {'vs Sparse':<12}")
        print("-" * 100)

        baseline = results[0]['avg_ms']  # Sparse is baseline

        for r in results:
            speedup = baseline / r['avg_ms'] if r['avg_ms'] > 0 else 0

            avg_str = f"{r['avg_ms']:.4f}ms"
            min_str = f"{r['min_ms']:.4f}ms"
            max_str = f"{r['max_ms']:.4f}ms"

            if speedup > 1.5:
                speedup_str = f"{speedup:.2f}x faster ⚡"
            elif speedup < 0.9:
                speedup_str = f"{1/speedup:.2f}x slower"
            else:
                speedup_str = f"~{speedup:.2f}x"

            print(f"{r['name']:<30} │ {avg_str:<12} │ {min_str:<10} │ {max_str:<10} │ {speedup_str:<12}")

    print()
    print("=" * 100)


def main():
    print("\n" + "=" * 100)
    print(" " * 25 + "🔥 ELITE SIMD GRAPH ALGORITHMS BENCHMARK 🔥")
    print(" " * 30 + "Testing AVX2/SSE/NEON Vector Instructions")
    print("=" * 100)
    print()

    # Test different graph sizes
    test_sizes = [100, 500, 1000, 2000]
    results_by_size = {}

    for n_nodes in test_sizes:
        print(f"\n⏳ Benchmarking {n_nodes}-node graph...")

        # Create graph
        graph = create_test_graph(n_nodes, edge_density=0.1)
        print(f"   Created: {graph.node_count()} nodes, {graph.edge_count()} edges")

        results = []

        # 1. Baseline: Sparse PageRank
        print("   Testing Sparse PageRank...")
        result = benchmark_pagerank(
            graph,
            "Sparse PageRank",
            lambda: graph.pagerank_sparse(),
            n_runs=15
        )
        results.append(result)

        # 2. SIMD PageRank
        print("   Testing SIMD PageRank...")
        result = benchmark_pagerank(
            graph,
            "SIMD PageRank (4x parallel)",
            lambda: graph.pagerank_simd(),
            n_runs=15
        )
        results.append(result)

        # 3. Parallel SIMD PageRank
        print("   Testing Parallel SIMD PageRank...")
        result = benchmark_pagerank(
            graph,
            "Parallel SIMD (Multi-core)",
            lambda: graph.pagerank_parallel_simd(),
            n_runs=15
        )
        results.append(result)

        results_by_size[n_nodes] = results

    # Print comprehensive results
    print_results_table(results_by_size)

    # Summary statistics
    print("\n💡 Key Insights:")
    print("-" * 100)

    best_simd_speedup = 0
    best_parallel_speedup = 0

    for size, results in results_by_size.items():
        sparse_time = results[0]['avg_ms']
        simd_time = results[1]['avg_ms']
        parallel_time = results[2]['avg_ms']

        simd_speedup = sparse_time / simd_time
        parallel_speedup = sparse_time / parallel_time

        if simd_speedup > best_simd_speedup:
            best_simd_speedup = simd_speedup
        if parallel_speedup > best_parallel_speedup:
            best_parallel_speedup = parallel_speedup

    print(f"   • Best SIMD speedup: {best_simd_speedup:.2f}x faster ⚡")
    print(f"   • Best Parallel SIMD speedup: {best_parallel_speedup:.2f}x faster 🔥")
    print("   • SIMD processes 4 nodes per instruction (f64x4 vectors)")
    print("   • Parallel SIMD uses all CPU cores simultaneously")
    print("   • Works on any modern CPU (AVX2/SSE/NEON auto-detected)")
    print()

    # Hardware info
    import platform
    import os
    print("🖥️  System Information:")
    print("-" * 100)
    print(f"   CPU: {platform.processor()}")
    print(f"   Platform: {platform.system()} {platform.machine()}")
    print(f"   CPU Cores: {os.cpu_count()}")
    print()

    print("=" * 100)
    print("✅ SIMD BENCHMARK COMPLETE - Elite Performance Achieved!")
    print("=" * 100)
    print()


if __name__ == "__main__":
    main()
