"""Phase 6 — abstract `DepthEstimator` port.

The domain depends only on the interface; concrete adapters
(`infrastructure/ml/depth_estimators.py`) implement it. This is the same
DDD seam used for `VisualizationProjectRepository` — see CONVENTIONS.md
§ "Abstract Repositories" (no `I`-prefix, plain ABC).
"""

from abc import ABC, abstractmethod

from .value_objects import DepthMap


class DepthEstimator(ABC):
    """Port for monocular depth estimation.

    A successful call returns a `DepthMap` aligned to the input image. The
    domain does not care how the depth was produced — local CPU ONNX, GPU,
    managed API. Adapters MUST normalize their output so callers get the
    same value range regardless of backend.
    """

    @abstractmethod
    async def estimate(self, image_bytes: bytes) -> DepthMap:
        """Run depth inference on a JPEG/PNG-encoded image.

        Args:
            image_bytes: raw bytes of the photo (JPEG or PNG).

        Returns:
            `DepthMap` with the same aspect ratio as the input.

        Raises:
            DepthEstimationError: if inference fails, the model is unavailable,
                or the input cannot be decoded. Callers map this to a 503/422
                at the HTTP boundary; the user keeps manual perspective.
        """
        ...
