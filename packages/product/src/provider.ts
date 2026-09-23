import { deriveProductErrorTextKey } from "./text"
import type { ProductAction } from "./action"

export type ProductProviderAvailability = "available" | "connected" | "auth_required" | "unavailable" | "unsupported"

export type ProductProviderAuthMethod = "api" | "oauth" | "custom"

export type ProductProviderRecovery = "none" | "connect" | "open_docs" | "retry"

export type ProductProviderDiagnostic = {
  code?: string
  message: string
  raw?: string
  textKey?: ReturnType<typeof deriveProductErrorTextKey>
}

export type ProductProviderStateInput = {
  providerID: string
  displayName?: string
  configured?: boolean
  connected?: boolean
  authRequired?: boolean
  unavailable?: boolean
  unsupported?: boolean
  authMethods?: ProductProviderAuthMethod[]
  hostAuthMethods?: ProductProviderAuthMethod[]
  defaultModel?: string
  modelsAvailable?: boolean
  diagnostic?: ProductProviderDiagnostic
}

export type ProductProviderState = {
  providerID: string
  displayName?: string
  availability: ProductProviderAvailability
  authMethods: ProductProviderAuthMethod[]
  hostAuthMethods: ProductProviderAuthMethod[]
  recovery: ProductProviderRecovery
  connected: boolean
  configured: boolean
  defaultModel?: string
  modelsAvailable: boolean
  diagnostic?: ProductProviderDiagnostic
}

export type ProductProviderAction = Extract<ProductAction, { type: `provider.${string}` }>

const AUTH_METHOD_ORDER: ProductProviderAuthMethod[] = ["api", "oauth", "custom"]

export function deriveProductProviderState(input: ProductProviderStateInput): ProductProviderState {
  const authMethods = normalizeAuthMethods(input.authMethods)
  const hostAuthMethods = normalizeAuthMethods(input.hostAuthMethods)
  const availability = input.unsupported
    ? "unsupported"
    : input.unavailable
      ? "unavailable"
      : input.connected
        ? "connected"
        : input.authRequired
          ? "auth_required"
          : "available"

  return {
    providerID: input.providerID,
    displayName: input.displayName,
    availability,
    authMethods,
    hostAuthMethods,
    recovery: recoveryFor(availability, hostAuthMethods),
    connected: input.connected === true,
    configured: input.configured === true,
    defaultModel: input.defaultModel,
    modelsAvailable: input.modelsAvailable === true,
    diagnostic: input.diagnostic
      ? {
          ...input.diagnostic,
          textKey: input.diagnostic.textKey ?? deriveProductErrorTextKey(input.diagnostic.code, input.diagnostic.message),
        }
      : undefined,
  }
}

export function deriveProductProviderStates(inputs: ProductProviderStateInput[]): ProductProviderState[] {
  return inputs
    .map(deriveProductProviderState)
    .sort((left, right) => (left.displayName ?? left.providerID).localeCompare(right.displayName ?? right.providerID) || left.providerID.localeCompare(right.providerID))
}

export function deriveProductProviderRecoveryAction(state: ProductProviderState): Extract<ProductAction, { type: `provider.${string}` }> | undefined {
  if (state.recovery === "connect") return { type: "provider.connect", providerID: state.providerID }
  if (state.recovery === "open_docs") return { type: "provider.openDocs", providerID: state.providerID }
  if (state.recovery === "retry") return { type: "provider.retry", providerID: state.providerID }
}

function normalizeAuthMethods(methods: ProductProviderAuthMethod[] | undefined) {
  const values = new Set(methods ?? [])
  return AUTH_METHOD_ORDER.filter((method) => values.has(method))
}

function recoveryFor(availability: ProductProviderAvailability, hostAuthMethods: ProductProviderAuthMethod[]) {
  if (availability === "unavailable") return "retry" as const
  if (availability !== "auth_required") return "none" as const
  return hostAuthMethods.length > 0 ? "connect" as const : "open_docs" as const
}
