"""TextureVisualization entity — блок «WWW в дизайне».

Привязывается к фактуре (Texture) и содержит данные для интерактивного
scroll-expansion блока на странице панели.

Поля:
- media_type: 'image' | 'video' — тип основного медиа
- media_url: URL mp4/YouTube или путь к фото
- poster_url: превью-картинка для видео
- bg_image_url: фоновое изображение подложки
- title: заголовок на первом экране
- subtitle: подзаголовок / дата / слоган
- scroll_hint: текст-подсказка скролла
- description: текстовый блок под раскрывшимся медиа
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


@dataclass
class TextureVisualization:
    """Entity — визуализация для блока «WWW в дизайне»."""

    id: str = field(default_factory=lambda: str(uuid4()))
    texture_id: str = ""                    # FK к Texture
    media_type: str = "image"              # 'image' | 'video'
    media_url: str = ""                     # URL или S3-путь
    poster_url: str = ""                    # poster для видео
    bg_image_url: str = ""                  # фоновое изображение
    title: str = ""                         # заголовок
    subtitle: str = ""                      # подзаголовок
    scroll_hint: str = "Листайте вверх"     # призыв к скроллу
    description: str = ""                   # текст под медиа
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def __post_init__(self) -> None:
        if self.media_type not in ("image", "video"):
            raise ValueError("TextureVisualization.media_type must be 'image' or 'video'")
