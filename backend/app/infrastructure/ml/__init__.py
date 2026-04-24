"""Phase 6 — Infrastructure-layer ML adapters.

Houses concrete `DepthEstimator` implementations. The domain only knows
about the ABC; this package owns model-specific imports (numpy, onnxruntime,
PIL) so the rest of the codebase can import the use case without paying the
ML dependency cost.
"""
