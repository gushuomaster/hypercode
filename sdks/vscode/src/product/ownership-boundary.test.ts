import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

test("VS Code consumes Product command and summary output instead of owning duplicate policies", () => {
  const menu = readFileSync(new URL("../panel/webview/app/composer-menu.ts", import.meta.url), "utf8")
  const app = readFileSync(new URL("../panel/webview/app/App.tsx", import.meta.url), "utf8")
  assert.equal(menu.includes('id: "slash-agents"'), false)
  assert.equal(menu.includes('id: "slash-new"'), false)
  assert.equal(app.includes("overallProductMcpStatus("), false)
  assert.equal(app.includes("overallProductLspStatus("), false)
})
