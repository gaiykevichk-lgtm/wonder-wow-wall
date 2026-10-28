"""Domain-layer repository ABC for `MediaAsset`.

Same convention as other contexts (see `user/repositories.py`): only the
operations needed by use cases are declared. Future phases (catalog,
banners) will extend with `find_by_purpose` etc. when there's a concrete
caller — adding stubs here prematurely just creates dead code in the
in-memory implementation.
"""
from abc import ABC, abstractmethod

from .entities import MediaAsset


class MediaAssetRepository(ABC):
    @abstractmethod
    async def create(self, asset: MediaAsset) -> MediaAsset:
        ...

    @abstractmethod
    async def get_by_id(self, asset_id: str) -> MediaAsset | None:
        ...

    @abstractmethod
    async def delete(self, asset_id: str) -> bool:
        """Returns True iff a row was removed. The caller (`DeleteMedia`
        use case) coordinates the file-system deletion separately so this
        method has only one job — DB row mutation.
        """
        ...
