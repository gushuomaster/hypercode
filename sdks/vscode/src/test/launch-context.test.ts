import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { buildEditorSeed, buildExplorerSeed } from "../core/launch-context"

describe("launch context", () => {
  test("uses selection lines when the editor selection is not empty", () => {
    const seed = buildEditorSeed({
      workspaceId: "file:///workspace",
      workspaceDir: "/workspace",
      filePath: "/workspace/src/app.ts",
      selection: { startLine: 4, endLine: 9, empty: false },
    })

    assert.deepEqual(seed?.parts, [{
      type: "file",
      path: "src/app.ts",
      kind: "file",
      selection: { startLine: 4, endLine: 9 },
      source: { value: "@src/app.ts#4-9", start: 0, end: 15 },
    }])
  })

  test("uses the current file when the selection is empty", () => {
    const seed = buildEditorSeed({
      workspaceId: "file:///workspace",
      workspaceDir: "/workspace",
      filePath: "/workspace/src/app.ts",
      selection: { startLine: 4, empty: true },
    })

    assert.deepEqual(seed, {
      workspaceId: "file:///workspace",
      dir: "/workspace",
      parts: [{
        type: "file",
        path: "src/app.ts",
        kind: "file",
        selection: undefined,
        source: { value: "@src/app.ts", start: 0, end: 11 },
      }],
    })
  })

  test("builds explorer seeds for multiple files in the same workspace", () => {
    const seed = buildExplorerSeed({
      workspaceId: "file:///workspace",
      workspaceDir: "/workspace",
      filePaths: [
        "/workspace/src/app.ts",
        "/workspace/src/lib/util.ts",
      ],
    })

    assert.deepEqual(seed, {
      workspaceId: "file:///workspace",
      dir: "/workspace",
      parts: [
        {
          type: "file",
          path: "src/app.ts",
          kind: "file",
          selection: undefined,
          source: { value: "@src/app.ts", start: 0, end: 11 },
        },
        {
          type: "file",
          path: "src/lib/util.ts",
          kind: "file",
          selection: undefined,
          source: { value: "@src/lib/util.ts", start: 0, end: 16 },
        },
      ],
    })
  })

  test("returns undefined when the selected file is outside the workspace", () => {
    const seed = buildEditorSeed({
      workspaceId: "file:///workspace",
      workspaceDir: "/workspace",
      filePath: "/other/app.ts",
      selection: { startLine: 1, empty: true },
    })

    assert.equal(seed, undefined)
  })
})
