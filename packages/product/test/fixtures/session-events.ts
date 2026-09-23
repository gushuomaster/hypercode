import type { ProductEvent, ProductSnapshot } from "../../src"

export const emptyProductSnapshot = {
  status: "idle",
  messages: [],
  tools: [],
  subagents: [],
  permissions: [],
  questions: [],
  resolved: {
    permissions: [],
    questions: [],
  },
} as ProductSnapshot

export const sessionLifecycleEvents = [
  { type: "session.status", sessionID: "session-1", status: "running" },
  {
    type: "message.updated",
    sessionID: "session-1",
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
    sessionID: "session-1",
    part: {
      id: "part-tool",
      messageID: "message-1",
      sessionID: "session-1",
      type: "tool",
      fields: {
        tool: "bash",
        callID: "call-1",
        state: { status: "running" },
      },
      tool: {
        name: "bash",
        callID: "call-1",
        status: "running",
      },
    },
  },
  { type: "permission.asked", sessionID: "session-1", request: { id: "permission-1", sessionID: "session-1" } },
  {
    type: "message.part.updated",
    sessionID: "session-1",
    part: {
      id: "part-tool",
      messageID: "message-1",
      sessionID: "session-1",
      type: "tool",
      fields: {
        tool: "bash",
        callID: "call-1",
        state: { status: "completed" },
      },
      tool: {
        name: "bash",
        callID: "call-1",
        status: "completed",
      },
    },
  },
  { type: "question.asked", sessionID: "session-1", request: { id: "question-1", sessionID: "session-1" } },
  { type: "permission.replied", sessionID: "session-1", requestID: "permission-1" },
  { type: "question.replied", sessionID: "session-1", requestID: "question-1" },
  { type: "session.status", sessionID: "session-1", status: "running" },
  { type: "session.status", sessionID: "session-1", status: "idle" },
] as ProductEvent[]

export const rawSessionLifecycleEvents = [
  { type: "session.status", properties: { sessionID: "session-1", status: { type: "busy" } } },
  {
    type: "message.updated",
    properties: {
      info: {
        id: "message-1",
        sessionID: "session-1",
        role: "assistant",
        time: { created: 1 },
      },
    },
  },
  {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part-tool",
        messageID: "message-1",
        sessionID: "session-1",
        type: "tool",
        tool: "bash",
        callID: "call-1",
        state: { status: "running" },
      },
    },
  },
  { type: "permission.asked", properties: { id: "permission-1", sessionID: "session-1" } },
  {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part-tool",
        messageID: "message-1",
        sessionID: "session-1",
        type: "tool",
        tool: "bash",
        callID: "call-1",
        state: { status: "completed" },
      },
    },
  },
  { type: "question.asked", properties: { id: "question-1", sessionID: "session-1" } },
  { type: "permission.replied", properties: { sessionID: "session-1", requestID: "permission-1" } },
  { type: "question.replied", properties: { sessionID: "session-1", requestID: "question-1", answers: [["yes"]] } },
  { type: "session.status", properties: { sessionID: "session-1", status: { type: "busy" } } },
  { type: "session.status", properties: { sessionID: "session-1", status: { type: "idle" } } },
]

export const parityTuiSessionInput = {
  sessionID: "session-1",
  status: { type: "busy" },
  messages: [
    {
      id: "message-1",
      sessionID: "session-1",
      role: "assistant" as const,
      time: { created: 1 },
    },
  ],
  parts: {
    "message-1": [
      {
        id: "part-tool",
        messageID: "message-1",
        sessionID: "session-1",
        type: "tool",
        tool: "bash",
        state: { status: "completed" },
      },
    ],
  },
  permissions: [{ id: "permission-1", sessionID: "session-1" }],
  questions: [{ id: "question-1", sessionID: "session-1" }],
}

export const parityVsCodeSessionInput = {
  sessionStatus: { type: "busy" },
  messages: parityTuiSessionInput.messages.map((info) => ({
    info,
    parts: parityTuiSessionInput.parts[info.id as keyof typeof parityTuiSessionInput.parts],
  })),
  permissions: parityTuiSessionInput.permissions,
  questions: parityTuiSessionInput.questions,
}

export const parityProductSnapshot = {
  status: "running",
  messages: [{
    id: "message-1",
    sessionID: "session-1",
    role: "assistant",
    createdAt: 1,
    parts: [{
      id: "part-tool",
      messageID: "message-1",
      sessionID: "session-1",
      type: "tool",
      fields: {
        tool: "bash",
        state: { status: "completed" },
      },
      tool: {
        name: "bash",
        status: "completed",
      },
    }],
  }],
  tools: [{
    id: "part-tool",
    messageID: "message-1",
    sessionID: "session-1",
    name: "bash",
    status: "completed",
  }],
  subagents: [],
  permissions: [{ id: "permission-1", sessionID: "session-1" }],
  questions: [{ id: "question-1", sessionID: "session-1" }],
  resolved: {
    permissions: [],
    questions: [],
  },
} satisfies ProductSnapshot
