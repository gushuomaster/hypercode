import { expect, test } from "bun:test"
import { toProductProviderStates } from "../../src/product/provider-adapter"

test("projects TUI provider data into the shared Product provider state", () => {
  const states = toProductProviderStates({
    providers: [{
      id: "openai",
      name: "OpenAI",
      models: { "gpt-5": { id: "gpt-5" } },
    }],
    connected: [],
    defaults: { openai: "gpt-5" },
    auth: { openai: [{ type: "api", label: "API key" }] },
  })

  expect(states).toEqual([{
    providerID: "openai",
    displayName: "OpenAI",
    availability: "auth_required",
    authMethods: ["api"],
    hostAuthMethods: ["api"],
    recovery: "connect",
    connected: false,
    configured: true,
    defaultModel: "gpt-5",
    modelsAvailable: true,
  }])
})
