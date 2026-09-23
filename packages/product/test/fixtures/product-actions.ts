import type { ProductAction, ProductSelectionAction } from "../../src"

export const productSelectionActionFixtures = [
  { type: "model.select", model: { providerID: "openai", modelID: "gpt-5" } },
  { type: "agent.select", agent: "plan" },
  { type: "variant.select", model: { providerID: "openai", modelID: "gpt-5" }, variant: "deep" },
] as const satisfies readonly ProductSelectionAction[]

export const productActionFixtures = [
  { type: "composer.submit", text: "hello", agent: "build", model: { providerID: "openai", modelID: "gpt-5" }, variant: "fast" },
  { type: "session.interrupt" },
  { type: "session.retry" },
  { type: "session.compact", model: { providerID: "openai", modelID: "gpt-5" } },
  { type: "session.undo" },
  { type: "session.redo" },
  { type: "session.select", sessionID: "session-2" },
  { type: "session.switch", sessionID: "session-3" },
  ...productSelectionActionFixtures,
  { type: "permission.reply", requestID: "permission-1", reply: "once" },
  { type: "question.reply", requestID: "question-1", answers: [["yes"]] },
  { type: "question.reject", requestID: "question-1" },
] as const satisfies readonly ProductAction[]
