import assert from "node:assert/strict"
import { test } from "node:test"
import { toProductLspStates } from "./lsp-adapter"

test("projects VS Code LSP statuses into the shared Product state", () => {
  assert.deepEqual(toProductLspStates([{ id: "ts", name: "TypeScript", root: "/workspace", status: "connected" }]), [
    { id: "ts", name: "TypeScript", root: "/workspace", availability: "connected", severity: "none" },
  ])
})
