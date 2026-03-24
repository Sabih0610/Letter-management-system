from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.core.config import get_settings

settings = get_settings()


class GeminiError(RuntimeError):
    pass


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


async def generate_json(prompt: str, *, temperature: float = 0.2) -> dict[str, Any]:
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured.")

    url = f"{settings.gemini_api_base}/models/{settings.gemini_model}:generateContent"
    params = {"key": settings.gemini_api_key}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
        },
    }
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, params=params, json=payload)
        if response.status_code >= 400:
            raise GeminiError(f"Gemini API error {response.status_code}: {response.text[:250]}")
        data = response.json()

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("Unexpected Gemini response format.") from exc

    text = _strip_json_fences(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiError(f"Gemini returned non-JSON content: {text[:250]}") from exc


async def generate_text(prompt: str, *, temperature: float = 0.2) -> str:
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is not configured.")

    url = f"{settings.gemini_api_base}/models/{settings.gemini_model}:generateContent"
    params = {"key": settings.gemini_api_key}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, params=params, json=payload)
        if response.status_code >= 400:
            raise GeminiError(f"Gemini API error {response.status_code}: {response.text[:250]}")
        data = response.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise GeminiError("Unexpected Gemini response format.") from exc

