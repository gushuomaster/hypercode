import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { parseAnchorFileReference } from "./FileRefText"

describe("parseAnchorFileReference", () => {
  test("treats auto-linkified bare filenames as local file references", () => {
    assert.deepEqual(parseAnchorFileReference("http://README.md", "README.md"), {
      key: "README.md",
      filePath: "README.md",
      line: undefined,
    })
  })

  test("preserves line numbers for auto-linkified bare filenames", () => {
    assert.deepEqual(parseAnchorFileReference("http://README.md:12", "README.md:12"), {
      key: "README.md",
      filePath: "README.md",
      line: 12,
    })
  })

  test("keeps real external links as external", () => {
    assert.equal(parseAnchorFileReference("https://example.com/README.md", "README.md"), undefined)
  })
})
