import assert from "node:assert/strict"
import { describe, test } from "node:test"
import type { AgentInfo, ProviderInfo, SessionMessage } from "../../../core/sdk"
import { setLocale } from "../../../i18n"
import { composerIdentity, composerMetrics, composerSelection, lastUserSelection, overallProductFormatterStatus, overallProductMcpStatus, providerModelById } from "./session-meta"

const providers: ProviderInfo[] = [{
  id: "p1",
  name: "Provider 1",
  models: {
    m1: { id: "m1", name: "Model 1", variants: { fast: {}, deep: {} }, limit: { context: 10000 } },
    m2: { id: "m2", name: "Model 2", limit: { context: 20000 } },
  },
}]

const agents: AgentInfo[] = [
  { name: "build", mode: "primary", model: { providerID: "p1", modelID: "m1" } },
  { name: "plan", mode: "primary", model: { providerID: "p1", modelID: "m2" } },
]

function userMessage(agent: string, modelID: string): SessionMessage {
  return {
    info: {
      id: "msg-1",
      sessionID: "session-1",
      role: "user",
      time: { created: 0 },
      agent,
      model: { providerID: "p1", modelID },
    },
    parts: [],
  }
}

describe("session meta composer state", () => {
  test("composerSelection prefers current override over last user message", () => {
    const selection = composerSelection({
      messages: [userMessage("build", "m1")],
      agents,
      defaultAgent: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: "plan",
      composerMentionAgentOverride: undefined,
    })

    assert.deepEqual(selection, {
      agent: "plan",
      model: { providerID: "p1", modelID: "m2" },
      variant: undefined,
    })
  })

  test("composerSelection keeps manual agent selection after typing plain text", () => {
    const selection = composerSelection({
      messages: [userMessage("build", "m1")],
      agents,
      defaultAgent: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: "plan",
      composerMentionAgentOverride: undefined,
    })

    assert.deepEqual(selection, {
      agent: "plan",
      model: { providerID: "p1", modelID: "m2" },
      variant: undefined,
    })
  })

  test("composerSelection falls back to default current agent without override", () => {
    const selection = composerSelection({
      messages: [userMessage("plan", "m2")],
      agents,
      defaultAgent: "build",
      agentMode: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: undefined,
      composerMentionAgentOverride: undefined,
    })

    assert.deepEqual(selection, {
      agent: "build",
      model: { providerID: "p1", modelID: "m1" },
      variant: undefined,
    })
  })

  test("composerSelection prefers the built-in session mode for an empty fresh session before plugin default agent", () => {
    const selection = composerSelection({
      messages: [],
      agents: [
        { name: "Sisyphus - Ultraworker", mode: "primary", model: { providerID: "p1", modelID: "m2" } },
        ...agents,
      ],
      defaultAgent: "Sisyphus - Ultraworker",
      agentMode: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: undefined,
      composerMentionAgentOverride: undefined,
    })

    assert.deepEqual(selection, {
      agent: "build",
      model: { providerID: "p1", modelID: "m1" },
      variant: undefined,
    })
  })

  test("composerIdentity shows current selection before historical message state", () => {
    const identity = composerIdentity({
      messages: [userMessage("build", "m1")],
      agents,
      defaultAgent: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      agentMode: "build",
      composerAgentOverride: "plan",
      composerMentionAgentOverride: undefined,
    })

    assert.deepEqual(identity, {
      agent: "plan",
      model: "Model 2",
      provider: "Provider 1",
      modelRef: { providerID: "p1", modelID: "m2" },
      variant: "",
    })
  })

  test("composerSelection lets agent mentions override manual selection for current draft", () => {
    const selection = composerSelection({
      messages: [userMessage("build", "m1")],
      agents,
      defaultAgent: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: "build",
      composerMentionAgentOverride: "plan",
    })

    assert.deepEqual(selection, {
      agent: "plan",
      model: { providerID: "p1", modelID: "m2" },
      variant: undefined,
    })
  })

  test("composerSelection prefers manual model override for the current agent", () => {
    const selection = composerSelection({
      messages: [userMessage("build", "m1")],
      agents,
      defaultAgent: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: "build",
      composerMentionAgentOverride: undefined,
      composerModelOverrides: {
        build: { providerID: "p1", modelID: "m2" },
      },
      composerModelVariants: {},
    })

    assert.deepEqual(selection, {
      agent: "build",
      model: { providerID: "p1", modelID: "m2" },
      variant: undefined,
    })
  })

  test("composerSelection falls back to configured model when the agent has no model", () => {
    const selection = composerSelection({
      messages: [],
      agents: [{ name: "build", mode: "primary" }],
      defaultAgent: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: { providerID: "p1", modelID: "m2" },
      composerAgentOverride: undefined,
      composerMentionAgentOverride: undefined,
      composerModelOverrides: {},
      composerModelVariants: {},
    })

    assert.deepEqual(selection, {
      agent: "build",
      model: { providerID: "p1", modelID: "m2" },
      variant: undefined,
    })
  })

  test("composerSelection returns stored variant for the selected model", () => {
    const selection = composerSelection({
      messages: [],
      agents,
      defaultAgent: "build",
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: undefined,
      composerMentionAgentOverride: undefined,
      composerModelOverrides: {},
      composerModelVariants: {
        "p1/m1": "fast",
      },
    })

    assert.deepEqual(selection, {
      agent: "build",
      model: { providerID: "p1", modelID: "m1" },
      variant: "fast",
    })
  })

  test("lastUserSelection returns the latest valid user model and variant", () => {
    const selection = lastUserSelection([
      userMessage("build", "m1"),
      {
        info: {
          id: "msg-2",
          sessionID: "session-1",
          role: "user",
          time: { created: 1 },
          agent: "plan",
          model: { providerID: "p1", modelID: "m2" },
          variant: "deep",
        },
        parts: [],
      },
    ], providers)

    assert.deepEqual(selection, {
      messageID: "msg-2",
      agent: "plan",
      model: { providerID: "p1", modelID: "m2" },
      variant: "deep",
    })
  })

  test("composerSelection falls back to the most recent valid model before provider default", () => {
    const selection = composerSelection({
      messages: [],
      agents: [],
      defaultAgent: undefined,
      providers,
      providerDefault: { p1: "m1" },
      configuredModel: undefined,
      composerAgentOverride: undefined,
      composerMentionAgentOverride: undefined,
      composerRecentModels: [{ providerID: "p1", modelID: "m2" }],
      composerModelOverrides: {},
      composerModelVariants: {},
    })

    assert.deepEqual(selection, {
      agent: undefined,
      model: { providerID: "p1", modelID: "m2" },
      variant: undefined,
    })
  })

  test("renders Product formatter and MCP projections without a legacy host reducer", () => {
    setLocale("en")
    assert.deepEqual(overallProductFormatterStatus([
      { name: "prettier", enabled: true, extensions: [".ts"], severity: "ok" },
      { name: "rustfmt", enabled: false, extensions: [".rs"], severity: "warning" },
    ]), {
      tone: "orange",
      items: [
        { name: "prettier", tone: "green", value: ".ts" },
        { name: "rustfmt", tone: "orange", value: "Disabled" },
      ],
    })
    assert.deepEqual(overallProductMcpStatus([
      { name: "docs", availability: "needs_auth", severity: "warning", action: "authenticate", diagnostic: undefined },
    ]), {
      tone: "orange",
      items: [{ name: "docs", tone: "orange", value: "Needs authentication", action: "authenticate", actionLabel: "authenticate" }],
    })
  })

  test("localizes Product status semantics while preserving raw diagnostics", () => {
    setLocale("zh")
    assert.equal(overallProductMcpStatus([
      {
        name: "docs",
        availability: "failed",
        severity: "error",
        availableActions: ["reconnect"],
        diagnostic: {
          message: "Connection refused",
          raw: "Connection refused",
          textKey: "error.mcp.connection_failed",
        },
      },
    ]).items[0]?.value, "MCP 服务器连接失败，请结合原始错误排查。\nConnection refused")
  })

  test("providerModelById falls back to model.id when the record key differs", () => {
    const mismatchedProviders: ProviderInfo[] = [{
      id: "p2",
      name: "Provider 2",
      models: {
        latest: { id: "model-real-id", name: "Model 3", limit: { context: 32000 } },
      },
    }]

    assert.deepEqual(providerModelById(mismatchedProviders[0], "model-real-id"), {
      id: "model-real-id",
      name: "Model 3",
      limit: { context: 32000 },
    })
  })

  test("composerMetrics falls back to the current selected model limit when the last assistant model no longer resolves", () => {
    const metrics = composerMetrics({
      messages: [{
        info: {
          id: "assistant-1",
          sessionID: "session-1",
          role: "assistant",
          time: { created: 2 },
          model: { providerID: "p1", modelID: "retired-model-id" },
          tokens: {
            input: 3000,
            output: 1000,
            reasoning: 500,
            cache: {
              read: 500,
              write: 0,
            },
          },
          cost: 0.2,
        },
        parts: [],
      }],
      providers,
      model: { providerID: "p1", modelID: "m1" },
    })

    assert.deepEqual(metrics, {
      tokens: 5000,
      percent: 50,
      cost: 0.2,
    })
  })
})
