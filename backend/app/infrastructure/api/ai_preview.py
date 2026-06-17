"""AI Preview generation endpoint using Nano Banana Flash."""

import base64
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import httpx

router = APIRouter()


class GeneratePreviewRequest(BaseModel):
    """Request body for AI preview generation."""

    photo_url: str = Field(..., description="Base64 data URL of the wall photo")
    design_name: str = Field(..., description="Selected design name")
    design_color: str = Field("#FFFFFF", description="Selected color hex")
    design_image_url: str | None = Field(
        None, description="URL or base64 data URL of the selected panel design texture"
    )
    prompt: str | None = Field(None, description="Custom prompt override")


class GeneratePreviewResponse(BaseModel):
    """Response with generated preview image."""

    preview_url: str = Field(..., description="Base64 data URL of generated preview")
    revised_prompt: str | None = Field(None, description="Prompt used for generation")


PROMTO_API_KEY = os.environ.get("PROMTO_API_KEY", "")


async def image_to_data_url(url: str) -> str:
    """Convert an image URL or base64 data URL into a data URL ready for vision APIs.

    Supports:
      - data:image/...;base64,... -> returned as-is
      - http://... / https://...  -> downloaded and encoded
      - absolute file paths       -> read from disk and encoded
    """
    if url.startswith("data:image/"):
        return url

    if url.startswith("http://") or url.startswith("https://"):
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502, detail=f"Failed to download design image: {resp.status_code}"
            )
        mime = resp.headers.get("content-type", "image/png").split(";")[0]
        b64 = base64.b64encode(resp.content).decode()
        return f"data:{mime};base64,{b64}"

    # Map frontend /uploads/ paths to the local static directory
    if url.startswith("/uploads/"):
        local_path = os.path.join("/home/user/wonder-wow-wall", url.lstrip("/"))
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            ext = os.path.splitext(local_path)[1].lower()
            mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(ext, "image/png")
            return f"data:{mime};base64,{b64}"

    # Treat as local file path
    if os.path.exists(url):
        with open(url, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        ext = os.path.splitext(url)[1].lower()
        mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}.get(ext, "image/png")
        return f"data:{mime};base64,{b64}"

    raise HTTPException(status_code=422, detail=f"Unsupported design_image_url: {url[:80]}")


async def generate_wall_preview(
    photo_b64: str,
    design_name: str,
    design_color: str,
    design_image_url: str | None = None,
    custom_prompt: str | None = None,
) -> tuple[str, str]:
    """Generate a wall preview using Nano Banana Flash via Promto AI gateway.

    Returns (preview_b64_data_url, prompt_used).
    """
    if not PROMTO_API_KEY:
        raise HTTPException(
            status_code=500, detail="AI generation not configured (PROMTO_API_KEY missing)"
        )

    # Validate photo is a data URL
    if not photo_b64.startswith("data:image/"):
        raise HTTPException(status_code=422, detail="photo_url must be a base64 data URL")

    # Prepare design image if provided
    design_data_url = await image_to_data_url(design_image_url) if design_image_url else None

    # Build prompt
    if custom_prompt:
        prompt_text = custom_prompt
    else:
        prompt_text = (
            f"Transform the interior wall photo by applying '{design_name}' 3D wall panels. "
            f"Use the panel design texture shown in the reference image. "
            f"The panels should match the color {design_color}. "
            f"Keep the same room, lighting, camera angle, and perspective. "
            f"Make it photorealistic, high quality, natural interior lighting."
        )

    # Build multimodal content: text + wall photo + design texture
    content: list[dict] = [{"type": "text", "text": prompt_text}]
    content.append({"type": "image_url", "image_url": {"url": photo_b64}})
    if design_data_url:
        content.append({"type": "image_url", "image_url": {"url": design_data_url}})

    # Call Promto AI gateway with vision input
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.promto.ai/v1/images/generations",
            headers={
                "Authorization": f"Bearer {PROMTO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemini-2.5-flash-image",
                "prompt": content,
                "size": "1024x1024",
                "response_format": "b64_json",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"AI gateway error: {response.text}")

    result = response.json()

    # Debug: log the response structure
    print(f"AI API response keys: {result.keys()}")
    if "data" in result and len(result["data"]) > 0:
        print(f"First data item keys: {result['data'][0].keys()}")

    # Extract image from response
    if "data" in result and len(result["data"]) > 0:
        image_data = result["data"][0]
        if "b64_json" in image_data:
            return f"data:image/png;base64,{image_data['b64_json']}", prompt_text

    raise HTTPException(status_code=500, detail=f"No image in AI response: {result}")


@router.post(
    "/ai-preview",
    response_model=GeneratePreviewResponse,
    summary="Generate AI preview of wall with panels",
)
async def generate_preview(body: GeneratePreviewRequest):
    """Generate a realistic preview of a wall with the selected panel design.

    Uses Nano Banana Flash (gemini-2.5-flash-image) to render a photorealistic
    preview of the wall with panels applied, using both the uploaded wall photo
    and the selected panel design texture.
    """
    preview_url, prompt = await generate_wall_preview(
        photo_b64=body.photo_url,
        design_name=body.design_name,
        design_color=body.design_color,
        design_image_url=body.design_image_url,
        custom_prompt=body.prompt,
    )

    return GeneratePreviewResponse(
        preview_url=preview_url,
        revised_prompt=prompt,
    )
