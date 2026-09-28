import type { Config } from "@opencode-ai/sdk/v2"

export function toProductCapabilityConfigured(config: Config) {
  return {
    mcp: Object.values(config.mcp ?? {}).some((entry) => !("enabled" in entry) || entry.enabled !== false),
    lsp: config.lsp !== false,
    formatter: config.formatter !== false,
  }
}
