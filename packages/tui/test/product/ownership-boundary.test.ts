import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

test("TUI does not own shared slash names", () => {
  const app = read("../../src/app.tsx")
  expect(app.match(/slashName:\s*"(?:new|sessions|agents|models|mcps|status|themes|help|skills|connect|variants)"/g) ?? []).toEqual([])
})

test("TUI hosts do not decide capability wording, tone or availability from raw availability", () => {
  const files = [
    "../../src/component/dialog-mcp.tsx",
    "../../src/component/dialog-status.tsx",
    "../../src/routes/session/footer.tsx",
  ].map((path) => [path, read(path)] as const)

  for (const [path, source] of files) {
    // Product owns which text and severity an availability maps to.
    expect(source.match(/availability\s*===\s*"(?:failed|connected|disabled|needs_auth|needs_client_registration|unsupported)"/g) ?? [], path).toEqual([])
    // Whether to show a summary or a list is decided by Product's summary, not by how many states the host happens to hold.
    expect(source.match(/(?:mcp|lsp|formatter)_product\.length\s*>\s*0/g) ?? [], path).toEqual([])
  }
})

test("TUI capability adapter reports raw facts and does not carry configuration rules", () => {
  const adapter = read("../../src/product/capability-adapter.ts")
  expect(adapter.includes("toProductCapabilityConfigured")).toBe(false)
  expect(adapter.includes("some(")).toBe(false)
})
