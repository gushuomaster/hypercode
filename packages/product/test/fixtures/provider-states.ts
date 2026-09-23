import type { ProductProviderStateInput } from "../../src"

export const providerStateFixtures: ProductProviderStateInput[] = [
  {
    providerID: "available",
    displayName: "Available",
    configured: true,
    authMethods: ["api"],
    hostAuthMethods: ["api"],
    modelsAvailable: true,
  },
  {
    providerID: "connected",
    displayName: "Connected",
    configured: true,
    connected: true,
    authMethods: ["oauth"],
    hostAuthMethods: ["oauth"],
  },
  {
    providerID: "auth-required",
    displayName: "Auth Required",
    configured: true,
    authRequired: true,
    authMethods: ["oauth", "api"],
    hostAuthMethods: ["oauth", "api"],
  },
  {
    providerID: "unavailable",
    displayName: "Unavailable",
    unavailable: true,
    diagnostic: { code: "ProviderInitError", message: "Provider unavailable", raw: "HTTP 503" },
  },
]
