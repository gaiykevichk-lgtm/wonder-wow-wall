"""Persistent generation instruction. No process-local fallback."""
from sqlalchemy import text
from app.infrastructure.persistence.database import async_session

DEFAULT_SYSTEM_PROMPT = (
    "Создай фотореалистичную визуализацию отделки стены НА ИСХОДНОМ ФОТО клиента. "
    "Первое изображение — комната клиента: сохрани её перспективу, геометрию, окна, двери, "
    "мебель, пол, потолок и освещение. Не создавай другую комнату и не добавляй новые объекты. "
    "Второе изображение — образец выбранной фактуры: используй именно его цвет, рисунок и "
    "материал для отделки стены. Если образец не содержит рельефа базовой панели, не выдумывай "
    "конкретную форму панели. Изменяй только указанную стену или выделенную область. "
    "Соблюдай размеры стены, стиль, материал, покрытие и пожелания из параметров проекта. "
    "Для выделенной области используй её относительные координаты, вне области фото не меняй. "
    "Результат — одно изображение той же комнаты с отделкой, без подписей, коллажей и водяных знаков."
)


def compose_generation_prompt(system_prompt: str, context: str) -> str:
    return f"{system_prompt.strip()}\n\nПараметры текущего проекта:\n{context}"


async def read_prompt_settings() -> dict:
    async with async_session() as db:
        if db is None:
            raise RuntimeError("Для настройки конфигуратора требуется PostgreSQL")
        result = await db.execute(text(
            "SELECT system_prompt, updated_at FROM configurator_settings WHERE id = 1"
        ))
        row = result.mappings().one()
        return {"system_prompt": row["system_prompt"], "updated_at": row["updated_at"].isoformat()}


async def save_prompt_settings(system_prompt: str) -> dict:
    async with async_session() as db:
        if db is None:
            raise RuntimeError("Для настройки конфигуратора требуется PostgreSQL")
        result = await db.execute(text(
            "UPDATE configurator_settings SET system_prompt=:prompt, updated_at=now() "
            "WHERE id=1 RETURNING system_prompt, updated_at"
        ), {"prompt": system_prompt.strip()})
        row = result.mappings().one()
        await db.commit()
        return {"system_prompt": row["system_prompt"], "updated_at": row["updated_at"].isoformat()}
