import type { ProductSessionInput } from "../../src"

export const productSessionInputs = [
  {
    id: "session-a",
    title: "Alpha",
    createdAt: 1,
    updatedAt: 30,
    status: "busy",
    tags: [" docs ", "urgent", "docs"],
  },
  {
    id: "session-b",
    title: "",
    createdAt: 2,
    updatedAt: 20,
    status: "idle",
    tags: ["ops"],
  },
  {
    id: "session-child",
    title: "Child",
    createdAt: 3,
    updatedAt: 40,
    parentID: "session-a",
  },
  {
    id: "session-archived",
    title: "Archived",
    createdAt: 4,
    updatedAt: 50,
    archivedAt: 60,
  },
] satisfies ProductSessionInput[]

export const parityTuiSessionListInput = productSessionInputs.map((session) => ({
  id: session.id,
  title: session.title,
  parentID: session.parentID,
  time: {
    created: session.createdAt,
    updated: session.updatedAt,
    ...(session.archivedAt ? { archived: session.archivedAt } : {}),
  },
}))

export const parityVsCodeSessionListInput = parityTuiSessionListInput.map((session) => ({
  ...session,
  directory: "/workspace",
}))

export const paritySessionStatuses = {
  "session-a": { type: "busy" },
  "session-b": { type: "idle" },
}

export const paritySessionTags = {
  "session-a": [" docs ", "urgent", "docs"],
  "session-b": ["ops"],
}

export const paritySessionLifecycleInput = [
  { id: "session-running", title: "Running", time: { updated: 50 } },
  { id: "session-retry", title: "Retry", time: { updated: 40 } },
  { id: "session-error", title: "Error", time: { updated: 30 } },
  { id: "session-aborted", title: "Aborted", time: { updated: 20 } },
]

export const paritySessionLifecycleStatuses = {
  "session-running": { type: "busy" },
  "session-retry": { type: "retry" },
  "session-error": { type: "error" },
  "session-aborted": { type: "aborted" },
}
