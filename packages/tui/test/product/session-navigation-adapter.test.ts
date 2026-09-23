import { expect, test } from "bun:test"
import { navigationFixture } from "../../../product/test/fixtures/session-navigation"
import { resolveTuiSessionNavigation } from "../../src/product/session-navigation-adapter"

test("projects equivalent TUI session graphs to Product navigation targets", () => {
  const sessions = navigationFixture.nodes.map((node) => ({
    id: node.id,
    parentID: node.parentID,
    title: node.title,
    available: node.available,
    time: { updated: node.order ?? 0, archived: node.archivedAt },
  }))
  expect(resolveTuiSessionNavigation(sessions, { type: "subagent.open", sessionID: "root" })).toEqual({ available: true, sessionID: "child-a" })
  expect(resolveTuiSessionNavigation(sessions, { type: "subagent.sibling", sessionID: "child-a", direction: "next" })).toEqual({ available: true, sessionID: "child-b" })
})
