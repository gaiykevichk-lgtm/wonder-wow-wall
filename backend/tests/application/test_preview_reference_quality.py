import io
from PIL import Image
from app.infrastructure.api.ai_preview import _compress_image_bytes

def test_high_quality_reference_preserves_resolution():
    source = io.BytesIO()
    Image.new("RGB", (1800, 1200), "white").save(source, "PNG")
    result = _compress_image_bytes(source.getvalue(), max_dimension=1536, quality=95)
    assert Image.open(io.BytesIO(result)).size == (1536, 1024)

def test_small_source_is_not_artificially_upscaled():
    source = io.BytesIO()
    Image.new("RGB", (320, 240), "white").save(source, "PNG")
    result = _compress_image_bytes(source.getvalue(), max_dimension=1536, quality=95)
    assert Image.open(io.BytesIO(result)).size == (320, 240)
