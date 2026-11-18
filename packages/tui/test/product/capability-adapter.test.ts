import { expect, test } from "bun:test"
import { toProductCapabilityConfig } from "../../src/product/capability-adapter"

test("reports raw configuration facts without deciding what they mean", () => {
  expect(toProductCapabilityConfig({
    mcp: { docs: { type: "remote", url: "https://example.test" }, off: { enabled: false } },
    lsp: false,
    formatter: {},
  }, true)).toEqual({
    mcp: [{ name: "docs", enabled: true }, { name: "off", enabled: false }],
    lsp: false,
    formatter: true,
  })
})

test("an empty MCP configuration is reported as zero servers, not as disabled", () => {
  expect(toProductCapabilityConfig({ mcp: {}, lsp: {}, formatter: {} }, true)).toEqual({ mcp: [], lsp: true, formatter: true })
})

test("reports no facts at all until the config has loaded", () => {
  expect(toProductCapabilityConfig({}, false)).toEqual({})
})
