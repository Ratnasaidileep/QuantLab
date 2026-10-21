"""Analytics module for performance metrics, comparisons, tear sheets, and academic benchmark suites."""

from quantlab.analytics.benchmark_suite import (
    BenchmarkMatrixResult,
    BenchmarkRow,
    generate_benchmark_matrix,
)

__all__ = [
    "BenchmarkMatrixResult",
    "BenchmarkRow",
    "generate_benchmark_matrix",
]
