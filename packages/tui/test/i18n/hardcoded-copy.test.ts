import { describe, expect, test } from "bun:test"
import path from "path"

const files = [
  "app.tsx",
  "component/dialog-console-org.tsx",
  "component/dialog-debug.tsx",
  "component/dialog-mcp.tsx",
  "component/dialog-move-session.tsx",
  "component/dialog-provider.tsx",
  "component/dialog-session-delete-failed.tsx",
  "component/dialog-session-list.tsx",
  "component/dialog-session-rename.tsx",
  "component/dialog-skill.tsx",
  "component/dialog-status.tsx",
  "component/dialog-stash.tsx",
  "component/dialog-theme-list.tsx",
  "component/dialog-variant.tsx",
  "component/dialog-workspace-create.tsx",
  "component/dialog-workspace-list.tsx",
  "component/dialog-workspace-unavailable.tsx",
  "component/error-component.tsx",
  "ui/dialog-alert.tsx",
  "ui/dialog-confirm.tsx",
  "ui/dialog-export-options.tsx",
  "ui/dialog-help.tsx",
  "ui/toast.tsx",
  "routes/session/index.tsx",
  "routes/session/permission.tsx",
  "routes/session/question.tsx",
  "routes/session/sidebar.tsx",
  "routes/session/footer.tsx",
  "routes/session/subagent-footer.tsx",
  "routes/session/dialog-message.tsx",
  "routes/session/dialog-subagent.tsx",
  "routes/session/dialog-fork-from-timeline.tsx",
  "routes/session/dialog-timeline.tsx",
  "feature-plugins/system/diff-viewer.tsx",
  "feature-plugins/system/diff-viewer-file-tree.tsx",
  "feature-plugins/system/plugins.tsx",
  "feature-plugins/system/which-key.tsx",
  "feature-plugins/sidebar/context.tsx",
  "feature-plugins/sidebar/files.tsx",
  "feature-plugins/sidebar/footer.tsx",
  "feature-plugins/sidebar/mcp.tsx",
  "feature-plugins/sidebar/todo.tsx",
  "feature-plugins/home/tips-view.tsx",
]

const allowed = new Set(["API key", "Glob", "Grep", "HyperCode", "JSON", "LSP", "MCP", "Shell", "WebFetch", "c", "ctrl+c", "enter", "esc", "opencode"])
const attributes = /\b(?:title|description|placeholder|message|category|pending|complete|footer|empty|label|action)\s*=\s*["']([^"']*[A-Za-z][^"']*)["']/g
const properties = /\b(?:title|description|placeholder|message|category|pending|complete|footer|empty|label)[ \t]*:[ \t]*["'`]([^"'`\n]*[A-Za-z][^"'`\n]*)["'`]/g
const text = /<(?:text|span)\b[^>]*>\s*([A-Za-z][^<>{}\n]*)\s*</g

describe("TUI localized copy", () => {
  test("keeps main dialogs free of hardcoded English product copy", async () => {
    const violations: string[] = []
    for (const file of files) {
      const source = await Bun.file(path.join(import.meta.dir, "..", "..", "src", file)).text()
      const audited = source
        .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
        .replace(/^\s*\/\/.*$/gm, (comment) => comment.replace(/[^\n]/g, " "))
      for (const pattern of [attributes, properties, text]) {
        pattern.lastIndex = 0
        for (const match of audited.matchAll(pattern)) {
          const value = match[1].trim()
          if (allowed.has(value)) continue
          const normalized = value.replace(/\$\{[^}]+\}/g, "").trim()
          if (allowed.has(normalized)) continue
          if (!normalized.match(/[A-Za-z]/)) continue
          const line = source.slice(0, match.index).split("\n").length
          violations.push(`${file}:${line}: ${value}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
