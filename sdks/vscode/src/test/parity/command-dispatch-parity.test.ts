import assert from "node:assert/strict"
import { test } from "node:test"
import { productCommandIDs } from "@opencode-ai/product"
import { toVsCodeCommandTarget } from "../../product/command-adapter"
import { runProductCommand, type VsCodeCommandHandlers } from "../../panel/webview/app/command-dispatch"

// Handler completeness is enforced at compile time by Record<VsCodeCommandTarget, ...>; this checks the runtime mapping.
test("every shared Product command has a VS Code target and dispatches to it", () => {
  for (const id of productCommandIDs) {
    const target = toVsCodeCommandTarget(id)
    assert.equal(typeof target, "string", `${id} has no VS Code target`)
    const called: string[] = []
    const handlers = new Proxy({} as VsCodeCommandHandlers, {
      get: (_, name: string) => () => called.push(name),
    })
    runProductCommand(id, handlers)
    assert.deepEqual(called, [target], id)
  }
})

test("/help dispatches to the command help target", () => {
  assert.equal(toVsCodeCommandTarget("help.show"), "openCommandHelp")
})
