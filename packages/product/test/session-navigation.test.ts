import { expect, test } from "bun:test"
import { deriveProductSessionNavigation, resolveProductSessionNavigation } from "../src/session-navigation"
import { navigationFixture } from "./fixtures/session-navigation"

test("prefers a valid active child and falls back to deterministic first child", () => {
  const projection = deriveProductSessionNavigation(navigationFixture)
  expect(projection.defaultChildID).toBe("child-b")

  expect(deriveProductSessionNavigation({
    ...navigationFixture,
    activeChildID: "child-offline",
  }).defaultChildID).toBe("child-a")
})

test("resolves parent, wrapped siblings, and explicit children", () => {
  const projection = deriveProductSessionNavigation({
    ...navigationFixture,
    currentSessionID: "child-a",
  })
  expect(resolveProductSessionNavigation(projection, { type: "subagent.back", sessionID: "child-a" })).toEqual({ available: true, sessionID: "root" })
  expect(resolveProductSessionNavigation(projection, { type: "subagent.sibling", sessionID: "child-a", direction: "previous" })).toEqual({ available: true, sessionID: "child-b" })
  expect(resolveProductSessionNavigation(projection, { type: "subagent.sibling", sessionID: "child-a", direction: "next" })).toEqual({ available: true, sessionID: "child-b" })
  expect(resolveProductSessionNavigation(projection, { type: "subagent.select", sessionID: "root", targetSessionID: "child-b" })).toEqual({ available: true, sessionID: "child-b" })
})

test("returns explicit unavailable reasons for missing and unavailable targets", () => {
  const projection = deriveProductSessionNavigation(navigationFixture)
  expect(resolveProductSessionNavigation(projection, { type: "subagent.open", sessionID: "child-offline" })).toEqual({ available: false, reason: "unavailable" })
  expect(resolveProductSessionNavigation(projection, { type: "subagent.select", sessionID: "root", targetSessionID: "missing" })).toEqual({ available: false, reason: "missing_target" })
  expect(resolveProductSessionNavigation(deriveProductSessionNavigation({ ...navigationFixture, currentSessionID: "missing" }), { type: "subagent.open", sessionID: "missing" })).toEqual({ available: false, reason: "missing_current" })
})
