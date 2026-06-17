import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { SessionInfo, SessionMessage, ToolPart } from "../../../core/sdk"
import { activeChildSessionId } from "./session-navigation"

function child(id: string): SessionInfo {
  return {
    id,
    directory: "/workspace",
    title: id,
    parentID: "root",
    time: {
      created: 0,
      updated: 0,
    },
  }
}

function task(id: string, sessionID: string, status: ToolPart["state"]["status"]): ToolPart {
  return {
    id,
    sessionID: "root",
    messageID: `msg-${id}`,
    type: "tool",
    tool: "task",
    state: {
      status,
      metadata: {
        sessionID,
      },
    },
  }
}

function message(...parts: SessionMessage["parts"]): SessionMessage {
  return {
    info: {
      id: `msg-${parts.length}`,
      sessionID: "root",
      role: "assistant",
      time: { created: 0 },
    },
    parts,
  }
}

describe("session navigation", () => {
  test("returns the most recent incomplete visible child session", () => {
    const messages = [
      message(task("one", "child-a", "running")),
      message(task("two", "child-b", "pending")),
    ]

    assert.equal(activeChildSessionId(messages, {}, {
      "child-a": child("child-a"),
      "child-b": child("child-b"),
    }), "child-b")
  })

  test("ignores completed child tasks and stale child ids", () => {
    const messages = [
      message(task("one", "missing", "running")),
      message(task("two", "child-a", "completed")),
    ]

    assert.equal(activeChildSessionId(messages, {}, {
      "child-a": child("child-a"),
    }), undefined)
  })

  test("finds active grandchild tasks from child messages", () => {
    const messages = [message(task("one", "child-a", "running"))]
    const childThread = [
      {
        info: {
          id: "msg-child",
          sessionID: "child-a",
          role: "assistant" as const,
          time: { created: 0 },
        },
        parts: [
          {
            ...task("two", "grandchild-a", "running"),
            sessionID: "child-a",
            messageID: "msg-child",
          },
        ],
      },
    ]

    assert.equal(activeChildSessionId(messages, {
      "child-a": childThread,
    }, {
      "child-a": child("child-a"),
      "grandchild-a": {
        ...child("grandchild-a"),
        parentID: "child-a",
      },
    }), "grandchild-a")
  })
})
