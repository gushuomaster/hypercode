import type { ProductCapabilityConfigInput } from "@opencode-ai/product"
import type { Config } from "@opencode-ai/sdk/v2"

// Host only reports raw configuration facts. Whether they mean unconfigured, disabled or unknown is decided by Product.
// `ready` is false until the host has actually loaded the config, so "not loaded yet" is never mistaken for "nothing configured".
export function toProductCapabilityConfig(config: Config, ready: boolean): ProductCapabilityConfigInput {
  if (!ready) return {}
  return {
    mcp: Object.entries(config.mcp ?? {}).map(([name, entry]) => ({
      name,
      enabled: !("enabled" in entry) || entry.enabled !== false,
    })),
    lsp: config.lsp !== false,
    formatter: config.formatter !== false,
  }
}
