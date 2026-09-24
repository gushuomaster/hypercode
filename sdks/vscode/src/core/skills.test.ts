import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { loadSkillCatalog } from "./skills"

test("loads the canonical Product skill order and source metadata", async () => {
  const workspaceDir = path.join(os.tmpdir(), "hypercode-skill-workspace")
  const result = await loadSkillCatalog(workspaceDir, {
    app: {
      skills: async () => ({
        data: [
          { name: "remote", content: "Remote instructions", location: "https://example.com/remote/SKILL.md" },
          { name: "builtin", content: "Built-in instructions", location: "<built-in>" },
          { name: "global", content: "Global instructions", location: path.join(os.homedir(), ".hypercode", "skills", "global", "SKILL.md") },
          { name: "project", content: "Project instructions", location: path.join(workspaceDir, ".hypercode", "skills", "project", "SKILL.md") },
        ],
      }),
    },
  })

  assert.deepEqual(result.map((entry) => ({ name: entry.name, scope: entry.scope, textKey: entry.textKey })), [
    { name: "project", scope: "project", textKey: "skill.scope.project" },
    { name: "global", scope: "global", textKey: "skill.scope.global" },
    { name: "builtin", scope: "builtin", textKey: "skill.scope.builtin" },
    { name: "remote", scope: "external", textKey: "skill.scope.external" },
  ])
})
