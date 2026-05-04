from __future__ import annotations


class TextureNotFoundError(LookupError):
    """Requested texture id does not exist."""


class TextureSlugConflictError(ValueError):
    """A texture with the supplied slug already exists."""


class TextureColorNotFoundError(LookupError):
    """Requested texture color id does not exist."""


class TextureHasVariantsError(ValueError):
    """Refused to delete a texture that has variant images attached."""


class VariantImageNotFoundError(LookupError):
    """Requested variant image does not exist."""


class VariantImageCombinationConflictError(ValueError):
    """A variant with this (design, texture, color) triple already exists."""
