import { describe, expect, test } from "bun:test"
import { deriveProductContextUsage } from "../src/context"

describe("context usage product state", () => {
  test("distinguishes an unknown context limit from zero percent usage", () => {
    expect(deriveProductContextUsage(18_196, undefined)).toEqual({ availability: "unknown" })
    expect(deriveProductContextUsage(0, 200_000)).toEqual({ availability: "known", percent: 0 })
    expect(deriveProductContextUsage(18_196, 200_000)).toEqual({ availability: "known", percent: 9 })
  })
})
