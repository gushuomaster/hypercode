import { isValidModelRef, modelKey, sameModelRef } from "./model"
import type { ComposerInput, ComposerSelection, ProductAgent, ProductModelRef } from "./types"

export function deriveComposerSelection(input: ComposerInput): ComposerSelection {
  const preferredAgent = input.mentionAgentOverride || input.agentOverride || (!input.messagesExist ? input.agentMode : undefined) || input.defaultAgent
  const agent = primaryAgent(input.agents, preferredAgent)
  const overrideModel = agent?.name ? input.modelOverrides?.[agent.name] : undefined
  const model = valid(input.providers, overrideModel)
    || valid(input.providers, agent?.model)
    || valid(input.providers, input.configuredModel)
    || (input.recentModels ?? []).find((item) => isValidModelRef(input.providers, item))
    || fallbackModel(input.providers, input.providerDefaults)
  const variantKey = model ? modelKey(model) : undefined
  const storedVariant = variantKey ? input.modelVariants?.[variantKey] : undefined
  const hasStoredVariant = !!variantKey && Object.hasOwn(input.modelVariants ?? {}, variantKey)
  const variant = hasStoredVariant
    ? storedVariant === "default" ? undefined : storedVariant
    : agent?.model && model && sameModelRef(agent.model, model) ? agent.variant : undefined
  return {
    agent: agent?.name,
    model,
    variant,
  }
}

export function cycleProductAgentName(agents: ProductAgent[], current?: string, direction: 1 | -1 = 1) {
  const visible = agents.filter((agent) => agent.mode !== "subagent" && !agent.hidden)
  if (visible.length === 0) return undefined
  const index = visible.findIndex((agent) => agent.name === current)
  if (index < 0) return direction === 1 ? visible[0]?.name : visible.at(-1)?.name
  return visible[(index + direction + visible.length) % visible.length]?.name
}

function primaryAgent(agents: ProductAgent[], preferred?: string) {
  if (preferred) {
    const selected = agents.find((agent) => agent.name === preferred && !agent.hidden)
    if (selected) return selected
  }
  return agents.find((agent) => !agent.hidden && agent.mode !== "subagent") || agents.find((agent) => !agent.hidden)
}

function valid(providers: ComposerInput["providers"], model: ProductModelRef | undefined) {
  return isValidModelRef(providers, model) ? model : undefined
}

function fallbackModel(providers: ComposerInput["providers"], defaults?: Record<string, string>) {
  const configured = providers
    .map((provider) => ({ providerID: provider.id, modelID: defaults?.[provider.id] ?? "" }))
    .find((model) => isValidModelRef(providers, model))
  if (configured) return configured
  return providers
    .flatMap((provider) => provider.models
      .filter((model) => model.status !== "deprecated")
      .map((model) => ({ providerID: provider.id, modelID: model.id })))
    .at(0)
}
