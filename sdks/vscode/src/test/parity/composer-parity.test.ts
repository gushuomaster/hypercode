import assert from "node:assert/strict"
import { beforeEach, describe, test } from "node:test"
import { setLocale } from "../../i18n"
import { composerParityFixtures } from "./composer-parity-fixtures"
import { runComposerParity } from "./composer-parity"

describe("composer autocomplete parity fixtures", () => {
  beforeEach(() => setLocale("en"))

  for (const fix of composerParityFixtures) {
    test(fix.name, () => {
      const result = runComposerParity(fix)
      assert.equal(result.trigger, fix.expected.trigger)
      if (fix.expected.trigger) {
        assert.equal(result.query, fix.expected.query)
      }
      assert.deepEqual(result.items, fix.expected.items)
      if (fix.expected.accepted) {
        assert.deepEqual(result.accepted, fix.expected.accepted)
      }
    })
  }
})
