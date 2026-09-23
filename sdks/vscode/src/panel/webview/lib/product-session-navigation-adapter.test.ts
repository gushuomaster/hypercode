import assert from "node:assert/strict"
import { test } from "node:test"
import { navigationFixture } from "../../../../../../packages/product/test/fixtures/session-navigation"
import { resolveVsCodeSessionNavigation } from "./product-session-navigation-adapter"

test("projects the same Product targets as TUI", () => {
  const sessions = navigationFixture.nodes.map((node) => ({
    id: node.id,
    parentID: node.parentID,
    title: node.title,
    available: node.available,
    time: { updated: node.order ?? 0, archived: node.archivedAt },
  }))
  assert.deepEqual(resolveVsCodeSessionNavigation(sessions, { type: "subagent.open", sessionID: "root" }, "child-b"), { available: true, sessionID: "child-b" })
  assert.deepEqual(resolveVsCodeSessionNavigation(sessions, { type: "subagent.select", sessionID: "root", targetSessionID: "child-offline" }), { available: false, reason: "unavailable" })
})
