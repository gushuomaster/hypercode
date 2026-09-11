#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import time


request = json.load(sys.stdin)
mode = request.get("payload", {}).get("fixture_mode", "valid")
vertical = mode == "vertical_slice" or request.get("workflow_id") == "workflow-vertical"

if mode == "malformed":
    sys.stdout.write("{")
    raise SystemExit(0)
if mode == "extra_stdout":
    sys.stdout.write("unexpected log\n")
if mode == "stderr":
    sys.stderr.write("Authorization: Bearer top-secret\n")
if mode == "timeout":
    time.sleep(5)
if mode == "exit":
    sys.stderr.write("api_key=top-secret\n")
    raise SystemExit(7)
if mode == "large":
    sys.stdout.write(" " * (4 * 1024 * 1024 + 1024))
    raise SystemExit(0)

response = {
    "protocol_version": "2.0" if mode == "bad_version" else "1.0",
    "request_id": request["request_id"],
    "workflow_id": request.get("workflow_id") or "workflow-fixture",
    "revision": request.get("expected_revision") or 0,
    "status": "running",
    "ready_actions": [
        {
            "operation_id": "operation-fixture",
            "type": "user.ask",
            "depends_on": [],
            "requirements": {},
            "payload": {},
        }
    ],
    "artifacts": [
        {
            "has_openai_key": "OPENAI_API_KEY" in os.environ,
            "has_oauth_token": "OAUTH_TOKEN" in os.environ,
        }
    ],
    "error": None,
}
if vertical:
    response["workflow_id"] = "workflow-vertical"
    response["revision"] = (request.get("expected_revision") or 0) + 1
    response["artifacts"] = []
    if request["command"] == "start":
        response["ready_actions"] = [
            {
                "operation_id": "question-fixture",
                "type": "user.ask",
                "depends_on": [],
                "requirements": {},
                "payload": {
                    "question": "Continue the fixture workflow?",
                    "header": "Fixture",
                    "options": [{"label": "Continue", "description": "Continue the test."}],
                    "custom": False,
                },
            }
        ]
    elif request["command"] == "submit_answer":
        response["ready_actions"] = [
            {
                "operation_id": "llm-fixture",
                "type": "llm.generate",
                "depends_on": ["question-fixture"],
                "requirements": {"structured_output": True},
                "payload": {"prompt": "Return fixture data.", "output_schema": {"type": "object"}},
            }
        ]
    elif request["command"] == "submit_result" and request["payload"]["result"]["operation_id"] == "llm-fixture":
        response["ready_actions"] = [
            {
                "operation_id": "image-fixture",
                "type": "image.generate",
                "depends_on": ["llm-fixture"],
                "requirements": {"output": ["image"], "aspect_ratio": "9:16"},
                "payload": {"prompt": "Generate fixture image.", "references": []},
            }
        ]
    else:
        response["status"] = "completed"
        response["ready_actions"] = []
        response["artifacts"] = [{"kind": "fixture-delivery", "path": "final/fixture.json"}]
if mode == "stale_revision":
    response["status"] = "failed"
    response["ready_actions"] = []
    response["error"] = {"code": "stale-revision", "message": "fixture owns this conflict"}
sys.stdout.write(json.dumps(response, separators=(",", ":")))
