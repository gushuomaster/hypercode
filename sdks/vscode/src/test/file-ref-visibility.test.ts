import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, test } from "node:test"

describe("file reference visibility", () => {
  test("shows a visible underline hint for openable file references before modifier keys are pressed", () => {
    const css = readFileSync(resolve(process.cwd(), "src/panel/webview/markdown.css"), "utf8")

    assert.match(css, /\.oc-inlineCode-file\s*\{[\s\S]*text-decoration:\s*underline;/)
    assert.match(css, /\.oc-fileRefText\.is-openable\s*\{[\s\S]*text-decoration:\s*underline;/)
    assert.match(css, /\.oc-inlineCode-file:hover\s*\{[\s\S]*text-decoration-color:/)
    assert.match(css, /\.oc-fileRefText\.is-openable:hover\s*\{[\s\S]*text-decoration-color:/)
  })
})
