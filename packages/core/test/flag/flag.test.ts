import { afterEach, describe, expect, test } from "bun:test"
import { truthy } from "../../src/flag/flag"

const hypercodeKey = "HYPERCODE_TEST_FLAG"
const opencodeKey = "OPENCODE_TEST_FLAG"
const originalHypercode = process.env[hypercodeKey]
const originalOpencode = process.env[opencodeKey]

describe("flag environment aliases", () => {
  afterEach(() => {
    restore(hypercodeKey, originalHypercode)
    restore(opencodeKey, originalOpencode)
  })

  test("reads the HyperCode alias", () => {
    process.env[hypercodeKey] = "true"

    expect(truthy(opencodeKey)).toBe(true)
  })

  test("prefers the HyperCode alias when both names are set", () => {
    process.env[hypercodeKey] = "false"
    process.env[opencodeKey] = "true"

    expect(truthy(opencodeKey)).toBe(false)
  })
})

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}
