"""Invoke the Lambda handler locally against the real Anthropic API.

Usage (PowerShell):
  $env:ANTHROPIC_API_KEY = "sk-ant-..."
  $env:APP_SHARED_SECRET = "test-secret"
  python test_local.py
"""

import json
import os
import pathlib
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252

os.environ.setdefault("APP_SHARED_SECRET", "test-secret")

from lambda_function import handler  # noqa: E402

FIXTURE = pathlib.Path(__file__).parent.parent / "fixtures" / "review-payload.json"


def invoke(body: str, secret: str) -> dict:
    event = {"headers": {"x-app-secret": secret}, "body": body, "isBase64Encoded": False}
    return handler(event, None)


def main() -> int:
    secret = os.environ["APP_SHARED_SECRET"]

    # 1. Bad secret -> 401
    res = invoke("{}", "wrong-secret")
    assert res["statusCode"] == 401, res
    print("PASS bad secret -> 401")

    # 2. Ping -> 200
    res = invoke(json.dumps({"ping": True}), secret)
    assert res["statusCode"] == 200, res
    print("PASS ping -> 200")

    # 3. Oversized body -> 413
    res = invoke("x" * (201 * 1024), secret)
    assert res["statusCode"] == 413, res
    print("PASS oversized -> 413")

    # 4. Real review against the API
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("SKIP real review — set ANTHROPIC_API_KEY to run it")
        return 0
    payload = FIXTURE.read_text(encoding="utf-8")
    res = invoke(payload, secret)
    print(f"review -> {res['statusCode']}")
    body = json.loads(res["body"])
    if res["statusCode"] != 200:
        print(body)
        return 1
    assert "coachingNotes" in body and "adjustments" in body, body
    assert "programChanges" in body, body
    print("\n--- Coaching notes ---")
    print(body["coachingNotes"])
    print(f"\n--- {len(body['adjustments'])} adjustment(s) ---")
    for adj in body["adjustments"]:
        print(f"  {adj['dayId']} / {adj['exerciseId']}: {adj['changes']} — {adj['reason']}")
    print(f"\n--- {len(body['programChanges'])} program change(s) ---")
    for change in body["programChanges"]:
        new = change.get("newExercise", {}).get("name", "")
        print(f"  {change['action']} {change['dayId']}/{change['exerciseId']}"
              f"{' -> ' + new if new else ''} — {change['reason']}")
    print("\nAll local checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
