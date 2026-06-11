import * as path from "node:path"
import type { ComposerFileSelection, ComposerPromptPart } from "../bridge/types"

export type LaunchSeed = {
  workspaceId: string
  dir: string
  parts: ComposerPromptPart[]
}

export function buildEditorSeed(input: {
  workspaceId: string
  workspaceDir: string
  filePath: string
  selection: { startLine: number; endLine?: number; empty: boolean }
}): LaunchSeed | undefined {
  const relativePath = relativeWorkspacePath(input.workspaceDir, input.filePath)
  if (!relativePath) {
    return undefined
  }

  const selection = input.selection.empty
    ? undefined
    : {
        startLine: input.selection.startLine,
        endLine: input.selection.endLine,
      }

  return {
    workspaceId: input.workspaceId,
    dir: input.workspaceDir,
    parts: [filePart(relativePath, selection)],
  }
}

export function buildExplorerSeed(input: {
  workspaceId: string
  workspaceDir: string
  filePaths: string[]
}): LaunchSeed | undefined {
  const parts = input.filePaths
    .map((filePath) => relativeWorkspacePath(input.workspaceDir, filePath))
    .flatMap((relativePath) => relativePath ? [filePart(relativePath)] : [])

  if (!parts.length) {
    return undefined
  }

  return {
    workspaceId: input.workspaceId,
    dir: input.workspaceDir,
    parts,
  }
}

function filePart(relativePath: string, selection?: ComposerFileSelection): ComposerPromptPart {
  const value = selection
    ? `@${relativePath}#${selection.startLine}${selection.endLine ? `-${selection.endLine}` : ""}`
    : `@${relativePath}`

  return {
    type: "file",
    path: relativePath,
    kind: "file",
    selection,
    source: {
      value,
      start: 0,
      end: value.length,
    },
  }
}

function relativeWorkspacePath(workspaceDir: string, filePath: string) {
  const relativePath = path.relative(workspaceDir, filePath)
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    return undefined
  }

  return relativePath.split(path.sep).join("/")
}
