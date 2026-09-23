import { projectProductAgents, projectProductProviders, type ProductAgent, type ProductProvider } from "@opencode-ai/product"
import type { AgentInfo, ProviderInfo } from "../../../core/sdk"

export function toProductProviders(providers: ProviderInfo[]): ProductProvider[] {
  return projectProductProviders(providers)
}

export function toProductAgents(agents: AgentInfo[]): ProductAgent[] {
  return projectProductAgents(agents)
}
