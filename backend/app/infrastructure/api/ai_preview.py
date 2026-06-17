"""AI Preview generation endpoint using Nano Banana Flash."""

import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import os
import httpx

router = APIRouter()


class GeneratePreviewRequest(BaseModel):
    """Request body for AI preview generation."""
    photo_url: str = Field(..., description="Base64 data URL of the wall photo")
    design_name: str = Field(..., description="Selected design name")
    design_color: str = Field("#FFFFFF", description="Selected color hex")
    prompt: str | None = Field(None, description="Custom prompt override")


class GeneratePreviewResponse(BaseModel):
    """Response with generated preview image."""
    preview_url: str = Field(..., description="Base64 data URL of generated preview")
    revised_prompt: str | None = Field(None, description="Prompt used for generation")


PROMTO_API_KEY = os.environ.get("PROMTO_API_KEY", "")


async def generate_wall_preview(
    photo_b64: str,
    design_name: str,
    design_color: str,
    custom_prompt: str | None = None,
) -> tuple[str, str]:
    """Generate a wall preview using Nano Banana Flash via Promto AI gateway.
    
    Returns (preview_b64, prompt_used).
    """
    if not PROMTO_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="AI generation not configured (PROMTO_API_KEY missing)"
        )
    
    # Decode the photo to get dimensions
    try:
        header, b64_data = photo_b64.split(",", 1)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid data URL format")
    
    # Build prompt based on design
    if custom_prompt:
        prompt = custom_prompt
    else:
        prompt = (
            f"A modern interior wall photo with {design_name} 3D wall panels applied. "
            f"The panels have a beautiful textured surface. "
            f"Professional interior photography, natural lighting, high quality."
        )
    
    # Call Promto AI gateway
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.promto.ai/v1/images/generations",
            headers={
                "Authorization": f"Bearer {PROMTO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemini-2.5-flash-image",
                "prompt": prompt,
                "size": "1024x1024",
            },
        )
    
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"AI gateway error: {response.text}"
        )
    
    result = response.json()
    
    # Extract image from response
    if "data" in result and len(result["data"]) > 0:
        image_data = result["data"][0]
        if "b64_json" in image_data:
            return f"data:image/png;base64,{image_data['b64_json']}", prompt
        elif "url" in image_data:
            # If URL returned, fetch and convert to base64
            image_response = await client.get(image_data["url"])
            image_b64 = base64.b64encode(image_response.content).decode()
            return f"data:image/png;base64,{image_b64}", prompt
    
    raise HTTPException(status_code=500, detail="No image in AI response")


@router.post(
    "/ai-preview",
    response_model=GeneratePreviewResponse,
    summary="Generate AI preview of wall with panels",
)
async def generate_preview(body: GeneratePreviewRequest):
    """Generate a realistic preview of a wall with the selected panel design.
    
    Uses Nano Banana Flash (gemini-2.5-flash-image) to render a photorealistic
    preview of the wall with panels applied.
    """
    preview_url, prompt = await generate_wall_preview(
        photo_b64=body.photo_url,
        design_name=body.design_name,
        design_color=body.design_color,
        custom_prompt=body.prompt,
    )
    
    return GeneratePreviewResponse(
        preview_url=preview_url,
        revised_prompt=prompt,
    )
