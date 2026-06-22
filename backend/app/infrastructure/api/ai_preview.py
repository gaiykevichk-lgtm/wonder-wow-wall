"""AI Preview generation using Nano Banana Flash via OpenRouter /v1/chat/completions multimodal API."""

import base64
import io
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import httpx
from PIL import Image

router = APIRouter()


class GeneratePreviewRequest(BaseModel):
    """Request body for AI preview generation."""

    photo_url: str = Field(..., description="Base64 data URL of the wall photo")
    design_name: str | None = Field(None, description="Selected design name (optional)")
    design_color: str = Field("#FFFFFF", description="Selected color hex")
    design_image_url: str | None = Field(
        None, description="URL or base64 data URL of the selected panel design texture"
    )
    prompt: str | None = Field(None, description="Custom prompt override")
    panel_size: str | None = Field(None, description="Panel size (e.g., '30x30', '30x60', '60x60')")


class GeneratePreviewResponse(BaseModel):
    """Response with generated preview image."""

    preview_url: str = Field(..., description="Base64 data URL of generated preview")
    revised_prompt: str | None = Field(None, description="Prompt used for generation")


PROMTO_API_KEY = os.environ.get("PROMTO_API_KEY", "")


def _decode_data_url(data_url: str) -> tuple[str, bytes]:
    """Split a data URL into (mime_type, decoded bytes)."""
    try:
        header, b64 = data_url.split(",", 1)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid data URL format") from exc
    mime = header.split(";")[0].split(":")[1] if ":" in header else "image/png"
    return mime, base64.b64decode(b64)


def _compress_image_bytes(
    image_bytes: bytes,
    max_dimension: int = 512,
    quality: int = 80,
    force_rgb: bool = True,
) -> bytes:
    """Resize and re-encode an image to a smaller JPEG."""
    img = Image.open(io.BytesIO(image_bytes))
    if force_rgb and img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    width, height = img.size
    if max(width, height) > max_dimension:
        ratio = max_dimension / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def _data_url_from_bytes(image_bytes: bytes, mime: str = "image/jpeg") -> str:
    b64 = base64.b64encode(image_bytes).decode()
    return f"data:{mime};base64,{b64}"


async def image_to_data_url(url: str, max_dimension: int = 512, quality: int = 80) -> str:
    """Convert an image URL or base64 data URL into a JPEG data URL."""
    raw_bytes: bytes | None = None

    if url.startswith("data:image/"):
        _, raw_bytes = _decode_data_url(url)
    elif url.startswith("http://") or url.startswith("https://"):
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502, detail=f"Failed to download design image: {resp.status_code}"
            )
        raw_bytes = resp.content
    elif url.startswith("/uploads/"):
        local_path = os.path.join("/home/user/wonder-wow-wall", url.lstrip("/"))
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                raw_bytes = f.read()
    elif os.path.exists(url):
        with open(url, "rb") as f:
            raw_bytes = f.read()

    if raw_bytes is None:
        raise HTTPException(status_code=422, detail=f"Unsupported design_image_url: {url[:80]}")

    compressed = _compress_image_bytes(raw_bytes, max_dimension=max_dimension, quality=quality)
    return _data_url_from_bytes(compressed, "image/jpeg")


async def generate_wall_preview(
    photo_b64: str,
    design_name: str | None,
    design_color: str,
    design_image_url: str | None = None,
    custom_prompt: str | None = None,
    panel_size: str | None = None,
) -> tuple[str, str]:
    """Generate a wall preview using Nano Banana Flash via /v1/chat/completions.

    Uses the multimodal content array: [photo, design_texture, text_prompt].
    The key is NOT saying "apply/edit to photo" — instead describe the GENERATED scene
    and use the photo as style reference.
    """
    if not PROMTO_API_KEY:
        raise HTTPException(
            status_code=500, detail="AI generation not configured (PROMTO_API_KEY missing)"
        )

    # Validate and compress the wall photo
    if not photo_b64.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="photo_url must be a base64 data URL")
    _, photo_bytes = _decode_data_url(photo_b64)
    compressed_photo = _compress_image_bytes(photo_bytes, max_dimension=256, quality=75)
    photo_data_url = _data_url_from_bytes(compressed_photo, "image/jpeg")

    # Prepare design image if provided
    design_data_url = None
    if design_image_url:
        design_data_url = await image_to_data_url(design_image_url, max_dimension=512, quality=85)
        print(f"[DEBUG] Design image URL: {design_image_url}")
        print(f"[DEBUG] Design data URL length: {len(design_data_url)}")
    else:
        print("[DEBUG] No design image URL provided")

    # Build content array: photo first (aspect ratio + style reference), design second
    content: list[dict] = []
    content.append({"type": "image_url", "image_url": {"url": photo_data_url}})
    if design_data_url:
        content.append({"type": "image_url", "image_url": {"url": design_data_url}})
    print(f"[DEBUG] Content items count: {len(content)}")
    for i, item in enumerate(content):
        print(f"[DEBUG] Content[{i}]: type={item.get('type')}, url_len={len(item.get('image_url',{}).get('url',''))}")

    # Build panel size description for prompt
    panel_size_text = "30×30 centimeters"  # default
    if panel_size:
        panel_size_text = panel_size.replace("x", "×") + " centimeters"
    
    if custom_prompt:
        content.append({"type": "text", "text": custom_prompt})
    else:
        content.append({
            "type": "text",
            "text": (
                f"I am giving you two images.\n"
                f"Image 1: A room.\n"
                f"Image 2: A CLOSE-UP PHOTOGRAPH of a 3D wall panel texture (size: {panel_size_text}).\n\n"
                f"Your task: Install the EXACT 3D wall panels from Image 2 onto ALL VISIBLE WALLS in the room (Image 1).\n"
                f"The panels have REAL 3D DEPTH and relief effect - show visible gaps and shadows between panels.\n"
                f"Panel size is {panel_size_text} each - use this to determine how panels are arranged.\n"
                f"Copy the texture PRECISELY as shown - do not generate a similar pattern, COPY this specific texture.\n"
                f"Match the perspective and lighting of Image 1.\n"
                f"Photorealistic result showing complete 3D wall panel installation on ALL walls."
            ),
        })

    # Use /v1/chat/completions with modalities for image output
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.promto.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {PROMTO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemini-2.5-flash-image",
                "messages": [{"role": "user", "content": content}],
                "modalities": ["image", "text"],
            },
        )

    if response.status_code != 200:
        # Check for no_balance error
        error_text = response.text
        if "no_balance" in error_text:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "no_balance",
                    "message": "Закончились кредиты AI-провайдера. Пополните баланс.",
                    "balance_credits": 126,  # Will be parsed from response
                }
            )
        raise HTTPException(status_code=502, detail=f"AI gateway error: {error_text}")

    result = response.json()

    # Extract image from chat/completions response
    choices = result.get("choices", [])
    if not choices:
        raise HTTPException(status_code=500, detail=f"No choices in AI response: {result}")

    message = choices[0].get("message", {})

    # Try result['choices'][0]['message']['images'] (OpenRouter format)
    images = message.get("images", [])
    if images and len(images) > 0:
        img_data = images[0].get("image_url", {})
        url_or_b64 = img_data.get("url", "")
        if url_or_b64.startswith("data:"):
            return url_or_b64, content[-1]["text"]
        elif "," in url_or_b64:
            return f"data:image/png;base64,{url_or_b64.split(',', 1)[1]}", content[-1]["text"]
        else:
            return url_or_b64, content[-1]["text"]

    # Try content array with image type
    content_resp = message.get("content")
    if isinstance(content_resp, list):
        for item in content_resp:
            if item.get("type") == "image":
                img_data = item.get("image", {})
                b64 = img_data.get("base64", "") if isinstance(img_data, dict) else ""
                if b64:
                    return f"data:image/png;base64,{b64}", content[-1]["text"]

    # Check for refusal
    refusal = message.get("refusal") or choices[0].get("refusal")
    if refusal:
        raise HTTPException(status_code=400, detail=f"AI refused: {refusal}")

    # Check if model returned text instead of image
    text_response = message.get("content") or choices[0].get("message", {}).get("content", "")
    if text_response:
        raise HTTPException(
            status_code=400,
            detail=f"AI returned text instead of image (safety or prompt issue): {str(text_response)[:200]}",
        )

    raise HTTPException(status_code=500, detail=f"No image in AI response: {result}")


@router.post(
    "/ai-preview",
    response_model=GeneratePreviewResponse,
    summary="Generate AI preview of wall with panels",
)
async def generate_preview(body: GeneratePreviewRequest):
    """Generate a realistic preview of a wall with the selected panel design.

    Uses Nano Banana Flash via /v1/chat/completions with multimodal input
    (wall photo + panel design texture + text prompt).
    Both images are used as visual context for generating the result.
    """
    preview_url, prompt = await generate_wall_preview(
        photo_b64=body.photo_url,
        design_name=body.design_name,
        design_color=body.design_color,
        design_image_url=body.design_image_url,
        custom_prompt=body.prompt,
        panel_size=body.panel_size,
    )

    return GeneratePreviewResponse(
        preview_url=preview_url,
        revised_prompt=prompt,
    )
