import { deriveProductProviderStates, type ProductProviderAuthMethod, type ProductProviderState, type ProductProviderStateInput } from "@opencode-ai/product"
import type { ProviderAuthMethod, ProviderInfo } from "../core/sdk"

export function toProductProviderStates(input: {
  providers: ProviderInfo[]
  connected?: string[]
  defaults?: Record<string, string>
  auth?: Record<string, ProviderAuthMethod[]>
}): ProductProviderState[] {
  const connected = new Set(input.connected ?? [])
  return deriveProductProviderStates(input.providers.map((provider): ProductProviderStateInput => {
    const authMethods = normalizeAuthMethods(input.auth?.[provider.id])
    return {
      providerID: provider.id,
      displayName: provider.name,
      configured: true,
      connected: connected.has(provider.id),
      authRequired: !connected.has(provider.id) && authMethods.length > 0,
      authMethods,
      hostAuthMethods: authMethods.filter((method) => method === "oauth"),
      defaultModel: input.defaults?.[provider.id],
      modelsAvailable: Object.keys(provider.models ?? {}).length > 0,
    }
  }))
}

function normalizeAuthMethods(methods: ProviderAuthMethod[] | undefined): ProductProviderAuthMethod[] {
  return (methods ?? []).flatMap((method) => method.type === "api" || method.type === "oauth" ? [method.type] : [])
}
