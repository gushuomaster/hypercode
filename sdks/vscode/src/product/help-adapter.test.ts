import assert from "node:assert/strict"
import { test } from "node:test"
import { toVsCodeProductHelpTopics } from "./help-adapter"

test("reports the missing VS Code help surface as unsupported", () => {
  assert.deepEqual(toVsCodeProductHelpTopics()[0]?.availability, "unsupported")
})
