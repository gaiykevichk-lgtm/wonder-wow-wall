"""Test different API formats for Nano Banana Flash image generation."""
import asyncio
import base64
import os
import httpx

PROMTO_API_KEY = os.environ.get("PROMTO_API_KEY", "")


def make_small_b64():
    """Create a tiny red 10x10 PNG base64."""
    import io
    try:
        from PIL import Image
    except ImportError:
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    img = Image.new("RGB", (100, 100), color="red")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def make_wall_b64():
    """Create a simple wall-like image."""
    import io
    try:
        from PIL import Image
    except ImportError:
        return make_small_b64()
    img = Image.new("RGB", (512, 512), color="#E8E8E8")
    return f"data:image/png;base64,{base64.b64encode(img_to_bytes(img)).decode()}"


def make_design_b64():
    """Create a simple pattern image."""
    import io
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return make_small_b64()
    img = Image.new("RGB", (256, 256), color="#4A90E2")
    draw = ImageDraw.Draw(img)
    for i in range(0, 256, 32):
        draw.line([(i, 0), (i, 256)], fill="white", width=2)
        draw.line([(0, i), (256, i)], fill="white", width=2)
    return f"data:image/png;base64,{base64.b64encode(img_to_bytes(img)).decode()}"


def img_to_bytes(img):
    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def test_text_only():
    """Test 1: standard text-only images/generations."""
    print("\n=== TEST 1: Text-only images/generations ===")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.promto.ai/v1/images/generations",
            headers={"Authorization": f"Bearer {PROMTO_API_KEY}"},
            json={
                "model": "google/gemini-2.5-flash-image",
                "prompt": "modern interior wall with 3D geometric panels",
                "size": "1024x1024",
                "response_format": "b64_json",
            },
        )
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Keys: {data.keys()}")
        print(f"Data[0] keys: {data['data'][0].keys() if 'data' in data and data['data'] else 'empty'}")
        return True
    print(f"Error: {resp.text[:500]}")
    return False


async def test_vision_in_generations():
    """Test 2: try to send images in images/generations (likely unsupported)."""
    print("\n=== TEST 2: images/generations with image inputs ===")
    photo_b64 = make_wall_b64()
    design_b64 = make_design_b64()
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.promto.ai/v1/images/generations",
            headers={"Authorization": f"Bearer {PROMTO_API_KEY}"},
            json={
                "model": "google/gemini-2.5-flash-image",
                "prompt": [
                    {"type": "text", "text": "Apply the design from the second image to the wall in the first image. Keep the room and lighting."},
                    {"type": "image_url", "image_url": {"url": photo_b64}},
                    {"type": "image_url", "image_url": {"url": design_b64}},
                ],
                "size": "1024x1024",
                "response_format": "b64_json",
            },
        )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    return resp.status_code == 200


async def test_chat_completions_vision():
    """Test 3: chat/completions with vision input and image generation model."""
    print("\n=== TEST 3: chat/completions with vision input ===")
    photo_b64 = make_wall_b64()
    design_b64 = make_design_b64()
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.promto.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {PROMTO_API_KEY}"},
            json={
                "model": "google/gemini-2.5-flash-image",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Generate a photorealistic interior photo. Apply the 3D wall panel design from the second image to the wall shown in the first image. Keep the same room, lighting, and perspective."},
                            {"type": "image_url", "image_url": {"url": photo_b64}},
                            {"type": "image_url", "image_url": {"url": design_b64}},
                        ],
                    }
                ],
                "max_tokens": 4096,
            },
        )
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Keys: {data.keys()}")
        msg = data.get("choices", [{}])[0].get("message", {})
        print(f"Message keys: {msg.keys()}")
        print(f"Content preview: {str(msg.get('content', ''))[:500]}")
        images = msg.get("images", [])
        print(f"Images count: {len(images)}")
        if images:
            print(f"Image[0] type: {type(images[0])}")
            print(f"Image[0] preview: {str(images[0])[:200]}")
        return True
    print(f"Error: {resp.text[:500]}")
    return False


async def test_images_edits():
    """Test 4: images/edits with wall photo and mask."""
    print("\n=== TEST 4: images/edits endpoint ===")
    photo_b64 = make_wall_b64()
    design_b64 = make_design_b64()
    # Need to convert to files
    import io
    photo_bytes = base64.b64decode(photo_b64.split(",")[1])
    design_bytes = base64.b64decode(design_b64.split(",")[1])
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.promto.ai/v1/images/edits",
            headers={"Authorization": f"Bearer {PROMTO_API_KEY}"},
            data={
                "model": "google/gemini-2.5-flash-image",
                "prompt": "Apply the design from reference image to the wall in the photo",
                "size": "1024x1024",
                "response_format": "b64_json",
            },
            files={
                "image": ("wall.png", io.BytesIO(photo_bytes), "image/png"),
                "mask": ("mask.png", io.BytesIO(design_bytes), "image/png"),
            },
        )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    return resp.status_code == 200


async def main():
    if not PROMTO_API_KEY:
        print("PROMTO_API_KEY not set!")
        return

    await test_text_only()
    await test_vision_in_generations()
    await test_chat_completions_vision()
    await test_images_edits()


if __name__ == "__main__":
    asyncio.run(main())
