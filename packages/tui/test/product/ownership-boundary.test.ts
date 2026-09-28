import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"

test("TUI does not own shared slash names or MCP failure priority", () => {
  const app = readFileSync(new URL("../../src/app.tsx", import.meta.url), "utf8")
  const mcp = readFileSync(new URL("../../src/component/dialog-mcp.tsx", import.meta.url), "utf8")
  expect(app.match(/slashName:\s*"(?:new|sessions|agents|models|mcps|status|themes|help|skills|connect|variants)"/g) ?? []).toEqual([])
  expect(mcp.includes("availability === \"failed\" ||")).toBe(true)
})
