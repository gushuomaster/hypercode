import { describe, expect, test } from "bun:test"
import { deriveProductProviderRecoveryAction, deriveProductProviderState, deriveProductProviderStates, type ProductProviderStateInput } from "../src"
import { providerStateFixtures } from "./fixtures/provider-states"

describe("provider product state", () => {
  test("projects the shared provider fixture into stable states", () => {
    expect(deriveProductProviderStates(providerStateFixtures).map((state) => ({
      providerID: state.providerID,
      availability: state.availability,
      recovery: state.recovery,
    }))).toEqual([
      { providerID: "auth-required", availability: "auth_required", recovery: "connect" },
      { providerID: "available", availability: "available", recovery: "none" },
      { providerID: "connected", availability: "connected", recovery: "none" },
      { providerID: "unavailable", availability: "unavailable", recovery: "retry" },
    ])
  })

  test("projects connected, available, and auth-required states deterministically", () => {
    const inputs: ProductProviderStateInput[] = [
      {
        providerID: "zeta",
        displayName: "Zeta",
        configured: true,
        authMethods: ["oauth", "api", "api"],
        hostAuthMethods: ["oauth", "api"],
        modelsAvailable: true,
      },
      {
        providerID: "alpha",
        displayName: "Alpha",
        configured: true,
        connected: true,
        authMethods: ["api"],
        hostAuthMethods: ["api"],
      },
      {
        providerID: "beta",
        displayName: "Beta",
        configured: true,
        authRequired: true,
        authMethods: ["oauth"],
        hostAuthMethods: ["oauth"],
      },
    ]

    expect(deriveProductProviderStates(inputs).map((state) => [state.providerID, state.availability, state.recovery])).toEqual([
      ["alpha", "connected", "none"],
      ["beta", "auth_required", "connect"],
      ["zeta", "available", "none"],
    ])
    expect(deriveProductProviderState(inputs[0])).toMatchObject({
      authMethods: ["api", "oauth"],
      hostAuthMethods: ["api", "oauth"],
      modelsAvailable: true,
    })
  })

  test("keeps host capability differences explicit without inventing auth support", () => {
    const provider: ProductProviderStateInput = {
      providerID: "api-only",
      configured: true,
      authRequired: true,
      authMethods: ["api"],
    }

    expect(deriveProductProviderState({ ...provider, hostAuthMethods: ["api"] })).toMatchObject({
      availability: "auth_required",
      recovery: "connect",
      authMethods: ["api"],
      hostAuthMethods: ["api"],
    })
    expect(deriveProductProviderState({ ...provider, hostAuthMethods: [] })).toMatchObject({
      availability: "auth_required",
      recovery: "open_docs",
      authMethods: ["api"],
      hostAuthMethods: [],
    })
  })

  test("preserves unavailable, unsupported, and raw diagnostics", () => {
    expect(deriveProductProviderState({
      providerID: "missing",
      unavailable: true,
      diagnostic: { code: "ProviderInitError", message: "raw provider failure", raw: "HTTP 503" },
    })).toMatchObject({ availability: "unavailable", recovery: "retry", diagnostic: { raw: "HTTP 503" } })
    expect(deriveProductProviderState({ providerID: "unsupported", unsupported: true })).toMatchObject({
      availability: "unsupported",
      recovery: "none",
    })
  })

  test("derives a host-neutral recovery action", () => {
    expect(deriveProductProviderRecoveryAction(deriveProductProviderState({
      providerID: "retry-me",
      unavailable: true,
    }))).toEqual({ type: "provider.retry", providerID: "retry-me" })
    expect(deriveProductProviderRecoveryAction(deriveProductProviderState({
      providerID: "docs",
      authRequired: true,
      authMethods: ["api"],
    }))).toEqual({ type: "provider.openDocs", providerID: "docs" })
    expect(deriveProductProviderRecoveryAction(deriveProductProviderState({
      providerID: "connected",
      connected: true,
    }))).toBeUndefined()
  })
})
