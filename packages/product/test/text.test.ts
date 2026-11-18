import { describe, expect, test } from "bun:test"
import { deriveProductErrorTextKey, productTextKeyForModelSection, projectProductEvent } from "../src"

describe("ProductTextKey", () => {
  test("maps shared model sections to semantic text keys", () => {
    expect((["favorites", "recent", "configured", "current", "free", "provider", "search"] as const).map(productTextKeyForModelSection)).toEqual([
      "model.section.favorites",
      "model.section.recent",
      "model.section.configured",
      "model.section.current",
      "model.section.free",
      undefined,
      undefined,
    ])
  })

  test("classifies provider errors without discarding original diagnostics", () => {
    expect(deriveProductErrorTextKey("ProviderAuthError", "Invalid API key")).toBe("error.provider.auth_failed")
    expect(deriveProductErrorTextKey("APIError", "Service unavailable")).toBe("error.provider.request_failed")
    expect(deriveProductErrorTextKey(undefined, "Unexpected failure")).toBe("error.unknown")
    // The remote-config message mentions "Authentication"; it must not read as a provider auth failure.
    expect(deriveProductErrorTextKey("ConfigRemoteAuthError", "Authentication is missing or has expired")).toBe("error.config.remote_auth")

    expect(projectProductEvent({
      type: "session.error",
      properties: {
        sessionID: "session-1",
        error: { name: "ProviderAuthError", data: { message: "Invalid API key" } },
      },
    })).toEqual({
      type: "session.error",
      sessionID: "session-1",
      error: {
        code: "ProviderAuthError",
        message: "Invalid API key",
        raw: "Invalid API key",
        textKey: "error.provider.auth_failed",
      },
    })
  })
})
