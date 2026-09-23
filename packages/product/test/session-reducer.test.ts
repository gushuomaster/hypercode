import { describe, expect, test } from "bun:test"
import { createProductSnapshot, derivePendingInteraction, mergeProductSnapshot, projectProductEvent, reduceProductEvent, type ProductEvent, type ProductSnapshot } from "../src"
import { emptyProductSnapshot, rawSessionLifecycleEvents, sessionLifecycleEvents } from "./fixtures/session-events"

function reduce(events: ProductEvent[], initial = emptyProductSnapshot) {
  return events.reduce(reduceProductEvent, initial)
}

describe("reduceProductEvent session lifecycle", () => {
  test("projects the host event sequence into the canonical lifecycle", () => {
    const events = rawSessionLifecycleEvents.map(projectProductEvent)
    expect(events.every((event) => !!event)).toBe(true)
    expect(reduce(events.filter((event): event is ProductEvent => !!event))).toEqual(reduce(sessionLifecycleEvents))
  })

  test("projects retry, abort, and provider failures with original diagnostics", () => {
    expect(projectProductEvent({
      type: "session.status",
      properties: {
        sessionID: "session-1",
        status: { type: "retry", attempt: 3, message: "rate limited", next: 200 },
      },
    })).toEqual({
      type: "session.retry",
      sessionID: "session-1",
      retry: { attempt: 3, message: "rate limited", nextAt: 200 },
    })
    expect(projectProductEvent({
      type: "session.error",
      properties: {
        sessionID: "session-1",
        error: { name: "MessageAbortedError", data: { message: "stopped" } },
      },
    })).toEqual({
      type: "session.aborted",
      sessionID: "session-1",
      message: "stopped",
      raw: "stopped",
    })
    expect(projectProductEvent({
      type: "session.error",
      properties: {
        sessionID: "session-1",
        error: { name: "APIError", data: { message: "Unauthorized" } },
      },
    })).toEqual({
      type: "session.error",
      sessionID: "session-1",
      error: { code: "APIError", message: "Unauthorized", raw: "Unauthorized", textKey: "error.provider.auth_failed" },
    })
  })

  test("keeps permission ahead of question and restores the next pending interaction after resolution", () => {
    const beforePermissionResolution = reduce(sessionLifecycleEvents.slice(0, 6))
    expect(derivePendingInteraction(beforePermissionResolution)).toEqual({ kind: "permission", requestID: "permission-1" })

    const beforeQuestionResolution = reduce(sessionLifecycleEvents.slice(0, 7))
    expect(derivePendingInteraction(beforeQuestionResolution)).toEqual({ kind: "question", requestID: "question-1" })

    expect(reduce(sessionLifecycleEvents)).toMatchObject({
      status: "idle",
      permissions: [],
      questions: [],
      resolved: {
        permissions: ["permission-1"],
        questions: ["question-1"],
      },
    })
  })

  test("ignores asked events that arrive after the request was resolved", () => {
    const snapshot = reduce([
      { type: "permission.replied", requestID: "permission-1" },
      { type: "permission.asked", request: { id: "permission-1", sessionID: "session-1" } },
      { type: "question.rejected", requestID: "question-1" },
      { type: "question.asked", request: { id: "question-1", sessionID: "session-1" } },
    ] as ProductEvent[])

    expect(snapshot.permissions).toEqual([])
    expect(snapshot.questions).toEqual([])
  })

  test("moves through retry, aborted, error, running, and idle with explicit reset rules", () => {
    const retried = reduce([{
      type: "session.retry",
      retry: { attempt: 2, message: "rate limited", nextAt: 100 },
    }] as ProductEvent[])
    expect(retried).toMatchObject({ status: "retry", retry: { attempt: 2, message: "rate limited", nextAt: 100 } })

    const aborted = reduce([{ type: "session.aborted", message: "stopped by user" }] as ProductEvent[], retried)
    expect(aborted).toMatchObject({ status: "aborted", error: { message: "stopped by user" } })
    expect(aborted.retry).toBeUndefined()

    const failed = reduce([{ type: "session.error", error: { message: "provider failed", raw: "HTTP 500" } }] as ProductEvent[], aborted)
    expect(failed).toMatchObject({ status: "error", error: { message: "provider failed", raw: "HTTP 500" } })

    const running = reduce([{ type: "session.status", status: "running" }] as ProductEvent[], failed)
    expect(running.status).toBe("running")
    expect(running.error).toBeUndefined()

    const idle = reduce([{ type: "session.status", status: "idle" }] as ProductEvent[], running)
    expect(idle.status).toBe("idle")
    expect(idle.error).toBeUndefined()
  })
})

test("mergeProductSnapshot hydrates pending state while preserving resolved tombstones", () => {
  const current = reduce([
    { type: "permission.replied", requestID: "permission-1" },
    { type: "question.replied", requestID: "question-1" },
  ] as ProductEvent[], createProductSnapshot())
  const next = mergeProductSnapshot(current, createProductSnapshot({
    status: "idle",
    permissions: [{ id: "permission-1" }],
    questions: [{ id: "question-1" }],
  }))

  expect(next).toMatchObject({
    status: "idle",
    permissions: [],
    questions: [],
    resolved: {
      permissions: ["permission-1"],
      questions: ["question-1"],
    },
  })
  expect(next.error).toBeUndefined()
  expect(next.retry).toBeUndefined()
})

describe("reduceProductEvent messages and parts", () => {
  test("upserts duplicate message and tool updates without growing the snapshot", () => {
    const updatedMessage = {
      id: "message-1",
      sessionID: "session-1",
      role: "assistant" as const,
      createdAt: 1,
      parts: [],
    }
    const runningTool = {
      id: "part-tool",
      messageID: "message-1",
      sessionID: "session-1",
      type: "tool" as const,
      tool: { name: "bash", callID: "call-1", status: "running" as const },
    }
    const completedTool = {
      ...runningTool,
      tool: { ...runningTool.tool, status: "completed" as const },
    }

    const snapshot = reduce([
      { type: "message.updated", message: updatedMessage },
      { type: "message.updated", message: updatedMessage },
      { type: "message.part.updated", part: runningTool },
      { type: "message.part.updated", part: completedTool },
      { type: "message.part.updated", part: completedTool },
    ] as ProductEvent[])

    expect(snapshot.messages).toHaveLength(1)
    expect(snapshot.messages[0]?.parts).toHaveLength(1)
    expect(snapshot.tools).toEqual([{
      id: "part-tool",
      messageID: "message-1",
      sessionID: "session-1",
      name: "bash",
      callID: "call-1",
      status: "completed",
    }])
  })

  test("applies deltas and removes parts and messages deterministically", () => {
    const snapshot = reduce([
      {
        type: "message.updated",
        message: {
          id: "message-2",
          sessionID: "session-1",
          role: "assistant",
          createdAt: 2,
          parts: [],
        },
      },
      {
        type: "message.updated",
        message: {
          id: "message-1",
          sessionID: "session-1",
          role: "assistant",
          createdAt: 1,
          parts: [],
        },
      },
      {
        type: "message.part.updated",
        part: {
          id: "part-text",
          messageID: "message-1",
          sessionID: "session-1",
          type: "text",
          fields: { text: "hel" },
        },
      },
      {
        type: "message.part.delta",
        messageID: "message-1",
        partID: "part-text",
        field: "text",
        delta: "lo",
      },
    ] as ProductEvent[])

    expect(snapshot.messages.map((message) => message.id)).toEqual(["message-1", "message-2"])
    expect(snapshot.messages[0]?.parts[0]?.fields).toEqual({ text: "hello" })

    const withoutPart = reduce([{
      type: "message.part.removed",
      messageID: "message-1",
      partID: "part-text",
    }] as ProductEvent[], snapshot)
    expect(withoutPart.messages[0]?.parts).toEqual([])

    const withoutMessage = reduce([{
      type: "message.removed",
      messageID: "message-1",
    }] as ProductEvent[], withoutPart)
    expect(withoutMessage.messages.map((message) => message.id)).toEqual(["message-2"])
  })

  test("projects subagent start, update, completion, and removal from message parts", () => {
    const base = reduce([{
      type: "message.updated",
      message: { id: "message-1", sessionID: "session-1", role: "assistant", parts: [] },
    }] as ProductEvent[])
    const running = reduce([{
      type: "message.part.updated",
      part: {
        id: "part-subagent",
        messageID: "message-1",
        sessionID: "session-1",
        type: "subagent",
        subagent: { agent: "explore", childSessionID: "child-1", status: "running" },
      },
    }] as ProductEvent[], base)
    expect(running.subagents).toEqual([{
      id: "part-subagent",
      messageID: "message-1",
      sessionID: "session-1",
      agent: "explore",
      childSessionID: "child-1",
      status: "running",
    }])

    const completed = reduce([{
      type: "message.part.updated",
      part: {
        id: "part-subagent",
        messageID: "message-1",
        sessionID: "session-1",
        type: "subagent",
        subagent: { agent: "explore", childSessionID: "child-1", status: "completed" },
      },
    }] as ProductEvent[], running)
    expect(completed.subagents[0]?.status).toBe("completed")

    const removed = reduce([{
      type: "message.part.removed",
      messageID: "message-1",
      partID: "part-subagent",
    }] as ProductEvent[], completed)
    expect(removed.subagents).toEqual([])
  })

  test("does not let tool updates replace a pending permission", () => {
    const snapshot = reduce(sessionLifecycleEvents.slice(0, 5))
    expect(derivePendingInteraction(snapshot)).toEqual({ kind: "permission", requestID: "permission-1" })
  })
})
