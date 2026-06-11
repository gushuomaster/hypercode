import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, test } from "node:test"

describe("panel density styles", () => {
  test("uses a compact transcript gap", () => {
    const css = readFileSync(resolve(process.cwd(), "src/panel/webview/layout.css"), "utf8")

    assert.match(css, /\.oc-log,\s*\.oc-footerInner,\s*\.oc-questionList,\s*\.oc-todoList,\s*\.oc-parts\s*\{\s*display:\s*grid;\s*gap:\s*6px;/s)
  })
})
