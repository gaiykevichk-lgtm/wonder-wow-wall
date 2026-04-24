"""Phase 6 — concrete `DepthEstimator` adapters.

Two implementations live here:

* `StubDepthEstimator` — deterministic gradient. Used by tests and by the
  default `container.get_depth_estimator()` so the API endpoint round-trips
  without an ONNX checkpoint on disk. Cannot satisfy production accuracy
  requirements; emits the same shape so frontend/integration tests pass.

* `LocalMiDaSDepthEstimator` — real CPU inference. Imports `numpy`,
  `onnxruntime`, and `PIL` *lazily* inside `estimate()` so that:
    1. The rest of the codebase imports cleanly without those deps installed
       (matters for unit tests in CI where we don't `pip install onnxruntime`).
    2. Missing-deps surface as `DepthEstimationError` at call-time with a
       clear message, not at module import.

The adapter selection happens in `app/container.py` based on
`settings.DEPTH_PROVIDER`. See `docs/design-docs/DEPTH-ESTIMATION-INFRA.md`.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.domain.visualizer.depth_estimator import DepthEstimator
from app.domain.visualizer.exceptions import DepthEstimationError
from app.domain.visualizer.value_objects import DepthMap


class StubDepthEstimator(DepthEstimator):
    """Deterministic stub — returns a linear depth gradient.

    Suitable for:
      * Domain/application/API unit tests (no model file, no ML deps).
      * Local dev when the user hasn't downloaded the MiDaS checkpoint.

    Not suitable for:
      * Production. A flat X-axis gradient is not a realistic depth map;
        the user should still be encouraged to draw corners manually if
        accuracy matters.

    Shape choice (linear gradient along X): the surface `depth(x, y) = a*x + b`
    is a *plane* in 3D (constant in y). That is exactly what
    `PlaneFittingService.fit` is designed to recover, so the integration
    test path (stub → fitter) returns a full-image BBox deterministically
    at default `inlier_tolerance`. (C9 fix — the previous radial gradient
    was a cone, not a plane, and RANSAC correctly refused it.)
    """

    def __init__(self, *, width: int = 64, height: int = 64):
        if width <= 0 or height <= 0:
            raise ValueError("StubDepthEstimator dimensions must be positive")
        self._width = width
        self._height = height

    async def estimate(self, image_bytes: bytes) -> DepthMap:
        # Image bytes are intentionally ignored — the contract is "give me a
        # plausible depth map of fixed size". Surface decode-failure semantics
        # cheaply by rejecting empty input so the API layer can exercise the
        # 503 branch in tests.
        if not image_bytes:
            raise DepthEstimationError("StubDepthEstimator: empty image_bytes")
        denom = max(self._width - 1, 1)
        values: list[float] = []
        for _y in range(self._height):
            for x in range(self._width):
                # Range [0.3, 0.7] keeps values in the normalised [0, 1]
                # depth band and gives a recognisable non-trivial plane.
                values.append(0.3 + 0.4 * x / denom)
        return DepthMap(width=self._width, height=self._height, values=tuple(values))


class LocalMiDaSDepthEstimator(DepthEstimator):
    """CPU-only ONNX adapter for MiDaS Small.

    Configuration via `settings.DEPTH_MODEL_PATH` and `settings.DEPTH_INPUT_SIZE`.
    The constructor only stores config — heavy imports happen on first
    `estimate()` call so tests that merely instantiate the class don't load
    onnxruntime or numpy.

    Output normalisation:
      MiDaS emits *inverse depth* in arbitrary units. We normalise to
      [0, 1] (min-max) so downstream `PlaneFittingService` is unit-agnostic.

    Concurrency:
      Session loading is guarded by `_session_lock` so two concurrent
      `estimate()` calls on a cold adapter do not race to build the ONNX
      session twice (150–200 MB allocation each).
    """

    def __init__(self, *, model_path: str, input_size: int = 256):
        if not model_path:
            raise ValueError("LocalMiDaSDepthEstimator requires a non-empty model_path")
        if input_size <= 0:
            raise ValueError("input_size must be > 0")
        self._model_path = model_path
        self._input_size = input_size
        # Cache the ONNX session across requests — building it is expensive
        # (~500 ms cold). `None` until first call so import errors surface
        # as DepthEstimationError, not constructor failure.
        self._session = None  # type: ignore[var-annotated]
        self._session_lock = asyncio.Lock()

    async def estimate(self, image_bytes: bytes) -> DepthMap:
        if not image_bytes:
            raise DepthEstimationError("LocalMiDaSDepthEstimator: empty image_bytes")

        # Lazy imports — see module docstring for why.
        try:
            import numpy as np  # type: ignore[import-not-found]
            import onnxruntime as ort  # type: ignore[import-not-found]
            from PIL import Image  # type: ignore[import-not-found]
        except ImportError as e:
            raise DepthEstimationError(
                f"LocalMiDaSDepthEstimator: ML dependency missing ({e}). "
                f"Install onnxruntime, numpy, pillow or set DEPTH_PROVIDER=stub."
            ) from e

        if self._session is None:
            async with self._session_lock:
                # Re-check under the lock — another coroutine may have built
                # the session while we were waiting.
                if self._session is None:
                    if not Path(self._model_path).is_file():
                        raise DepthEstimationError(
                            f"LocalMiDaSDepthEstimator: model file not found at "
                            f"{self._model_path!r}; download MiDaS Small ONNX checkpoint."
                        )
                    try:
                        self._session = ort.InferenceSession(
                            self._model_path,
                            providers=["CPUExecutionProvider"],
                        )
                    except Exception as e:  # ort raises RuntimeError on bad models
                        raise DepthEstimationError(
                            f"LocalMiDaSDepthEstimator: failed to load ONNX session: {e}"
                        ) from e

        # Decode + preprocess.
        try:
            from io import BytesIO
            img = Image.open(BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            raise DepthEstimationError(
                f"LocalMiDaSDepthEstimator: cannot decode image bytes: {e}"
            ) from e

        size = self._input_size
        img = img.resize((size, size), Image.BILINEAR)
        arr = np.asarray(img, dtype=np.float32) / 255.0  # HWC, [0, 1]
        # MiDaS-small ImageNet normalisation
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        arr = arr.transpose(2, 0, 1)[np.newaxis, ...]  # NCHW

        # Inference.
        input_name = self._session.get_inputs()[0].name
        try:
            output = self._session.run(None, {input_name: arr})[0]
        except Exception as e:
            raise DepthEstimationError(
                f"LocalMiDaSDepthEstimator: inference failed: {e}"
            ) from e

        # Output is (1, H, W) inverse-depth. Normalise to [0, 1] then invert
        # so 0 = nearest, 1 = farthest (the contract on DepthMap).
        depth = np.squeeze(output)  # (H, W)
        d_min, d_max = float(depth.min()), float(depth.max())
        if d_max - d_min < 1e-6:
            raise DepthEstimationError(
                "LocalMiDaSDepthEstimator: depth output is uniform (model failed)"
            )
        normalised = (depth - d_min) / (d_max - d_min)  # 0..1, inverse depth
        absolute = 1.0 - normalised  # 0 = nearest, 1 = farthest
        h, w = absolute.shape
        return DepthMap(
            width=int(w),
            height=int(h),
            # `np.ndarray.tolist()` already coerces to Python float — no
            # extra per-element conversion needed (N5 fix).
            values=tuple(absolute.reshape(-1).tolist()),
        )
