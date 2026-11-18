import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

test("VS Code consumes Product command and summary output instead of owning duplicate policies", () => {
  const menu = read("../panel/webview/app/composer-menu.ts")
  const app = read("../panel/webview/app/App.tsx")
  assert.equal(menu.includes('id: "slash-agents"'), false)
  assert.equal(menu.includes('id: "slash-new"'), false)
  assert.equal(app.includes("overallProductMcpStatus("), false)
  assert.equal(app.includes("overallProductLspStatus("), false)
})

test("VS Code does not infer capability configuration from how many states it holds", () => {
  const app = read("../panel/webview/app/App.tsx")
  assert.deepEqual(app.match(/(?:mcp|lsp|formatter)States\.length\s*>\s*0/g) ?? [], [])
  assert.equal(app.includes("capabilityConfigured"), false)
})

test("VS Code hosts do not choose capability wording or tone from raw availability", () => {
  for (const path of ["../panel/webview/lib/session-meta.ts", "../panel/webview/app/status-picker.tsx"]) {
    const source = read(path)
    // Product owns which text an availability maps to; the host renders textKey and severity.
    assert.deepEqual(source.match(/availability\s*===\s*"(?:failed|connected|disabled|needs_auth|needs_client_registration|unsupported)"/g) ?? [], [], path)
  }
})

test("VS Code snapshot reports raw configuration facts and carries no configuration rules", () => {
  const snapshot = read("../panel/provider/snapshot.ts")
  assert.equal(snapshot.includes("capabilityConfigured"), false)
  // Narrowed on purpose: snapshot.ts legitimately uses .some() elsewhere (child session de-duplication).
  assert.deepEqual(snapshot.match(/Object\.values\(configRes\.data\?\.(?:mcp|lsp|formatter)[^)]*\)\.some\(/g) ?? [], [])
  // `lsp !== false` only normalizes the SDK value into the boolean fact Product's input type asks for; it does not decide unconfigured/disabled/unknown.
})
