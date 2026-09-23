import { describe, expect, test } from "bun:test"
import { toProductProviderStates } from "./provider-adapter"

describe("VS Code provider product adapter", () => {
  test("keeps provider semantics while exposing only host-supported auth recovery", () => {
    const input = {
      providers: [{
        id: "openai",
        name: "OpenAI",
        models: { "gpt-5": { id: "gpt-5" } },
      }],
      connected: [],
      defaults: { openai: "gpt-5" },
      auth: { openai: [{ type: "api", label: "API key" }] },
    }

    expect(toProductProviderStates(input)).toEqual([{
      providerID: "openai",
      displayName: "OpenAI",
      availability: "auth_required",
      authMethods: ["api"],
      hostAuthMethods: [],
      recovery: "open_docs",
      connected: false,
      configured: true,
      defaultModel: "gpt-5",
      modelsAvailable: true,
    }])
  })

  test("matches TUI connected state for equivalent provider input", () => {
    expect(toProductProviderStates({
      providers: [{ id: "anthropic", name: "Anthropic", models: { claude: { id: "claude" } } }],
      connected: ["anthropic"],
      defaults: { anthropic: "claude" },
      auth: { anthropic: [{ type: "oauth", label: "OAuth" }] },
    })[0]).toMatchObject({
      providerID: "anthropic",
      availability: "connected",
      recovery: "none",
      connected: true,
    })
  })
})
