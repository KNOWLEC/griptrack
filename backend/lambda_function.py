"""GripTrack coach backend — AWS Lambda behind a Function URL.

Env vars:
  ANTHROPIC_API_KEY  - Anthropic API key
  APP_SHARED_SECRET  - shared secret the app sends as X-App-Secret
  MODEL_ID           - optional, defaults to claude-opus-4-8
"""

import base64
import json
import os

import anthropic

from coach_schema import COACH_SCHEMA
from prompts import COACH_SYSTEM_PROMPT, format_payload

MAX_BODY_BYTES = 200 * 1024


def _response(status: int, payload: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def handler(event, context):
    # CORS preflight — API Gateway appends the Access-Control-* headers itself,
    # but the preflight must get a 2xx, not the 401 the secret check would give.
    method = (event.get("requestContext", {}).get("http", {}) or {}).get("method", "")
    if method == "OPTIONS":
        return {"statusCode": 204, "headers": {}, "body": ""}

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    secret = os.environ.get("APP_SHARED_SECRET", "")
    if not secret or headers.get("x-app-secret") != secret:
        return _response(401, {"error": "unauthorized"})

    body_raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body_raw = base64.b64decode(body_raw).decode("utf-8")
    if len(body_raw.encode("utf-8")) > MAX_BODY_BYTES:
        return _response(413, {"error": "payload too large"})

    try:
        body = json.loads(body_raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return _response(400, {"error": "invalid JSON"})

    if body.get("ping"):
        return _response(200, {"ok": True})

    if "program" not in body or "sessions" not in body:
        return _response(400, {"error": "missing program or sessions"})

    client = anthropic.Anthropic()
    model = os.environ.get("MODEL_ID", "claude-opus-4-8")

    try:
        with client.messages.stream(
            model=model,
            max_tokens=8000,
            thinking={"type": "adaptive"},
            system=COACH_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": format_payload(body)}],
            output_config={"format": {"type": "json_schema", "schema": COACH_SCHEMA}},
        ) as stream:
            message = stream.get_final_message()
    except anthropic.APIStatusError as err:
        print(f"anthropic error {err.status_code}: {err.message}")
        return _response(502, {"error": f"coach model error ({err.status_code})"})
    except anthropic.APIConnectionError:
        return _response(502, {"error": "could not reach the coach model"})

    if message.stop_reason == "refusal":
        return _response(502, {"error": "coach model declined the request"})

    text = "".join(block.text for block in message.content if block.type == "text")
    print(
        f"model={model} stop={message.stop_reason} "
        f"in={message.usage.input_tokens} out={message.usage.output_tokens}"
    )

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        return _response(502, {"error": "coach model returned unparseable output"})

    return _response(200, result)
