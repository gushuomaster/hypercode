import { expect, test } from "bun:test"
import { toProductCapabilityConfigured } from "../../src/product/capability-adapter"

test("preserves explicit capability configuration facts", () => {
  expect(toProductCapabilityConfigured({
    mcp: { docs: { type: "remote", url: "https://example.test" }, off: { enabled: false } },
    lsp: false,
    formatter: {},
  })).toEqual({ mcp: true, lsp: false, formatter: true })
})

test("treats an empty capability configuration as not configured", () => {
  expect(toProductCapabilityConfigured({ mcp: {}, lsp: {}, formatter: {} })).toEqual({ mcp: false, lsp: true, formatter: true })
})
