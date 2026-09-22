import { describe, expect, test } from "bun:test"
import { errorData, errorFormat, errorMessage, sessionErrorMessage } from "../../src/util/error"

describe("util.error", () => {
  test("formats native Error instances", () => {
    const err = new Error("boom")
    expect(errorMessage(err)).toBe("boom")
    expect(errorFormat(err)).toContain("boom")

    const data = errorData(err)
    expect(data.type).toBe("Error")
    expect(data.message).toBe("boom")
    expect(String(data.formatted)).toContain("boom")
  })

  test("extracts message from record-like values", () => {
    const err = { message: "bad input", code: "E_BAD" }
    expect(errorMessage(err)).toBe("bad input")

    const data = errorData(err)
    expect(data.message).toBe("bad input")
    expect(data.code).toBe("E_BAD")
  })

  test("never returns bare {} for opaque object errors", () => {
    expect(errorFormat({})).not.toBe("{}")
    expect(errorFormat({})).toContain("no message")

    class OpaqueError {}
    const opaque = new OpaqueError()
    Object.defineProperty(opaque, "secret", { value: "hidden", enumerable: false })
    expect(errorFormat(opaque)).not.toBe("{}")
    expect(errorFormat(opaque)).toContain("OpaqueError")
  })

  test("handles opaque throwables with custom toString", () => {
    const err = {
      toString() {
        return "ResolveMessage: Cannot resolve module"
      },
    }

    expect(errorMessage(err)).toBe("ResolveMessage: Cannot resolve module")

    const data = errorData(err)
    expect(data.message).toBe("ResolveMessage: Cannot resolve module")
    expect(String(data.formatted)).toContain("ResolveMessage")
  })

  test("formats exhausted free usage with the reset duration in Chinese", () => {
    const error = {
      name: "APIError",
      data: {
        message: "Free usage exceeded",
        responseHeaders: { "retry-after": "73680" },
        responseBody: JSON.stringify({
          type: "error",
          error: { type: "FreeUsageLimitError", message: "Free usage exceeded" },
        }),
      },
    }

    expect(sessionErrorMessage(error, "zh")).toBe(
      "免费额度已用完，将在 20 小时 28 分钟后恢复。你可以切换到其他 Provider，或升级 HyperCode Go。",
    )
  })

  test("formats exhausted free usage in English", () => {
    const error = {
      name: "APIError",
      data: {
        message: "Free usage exceeded",
        responseHeaders: { "retry-after": "900" },
        responseBody: JSON.stringify({
          type: "error",
          error: { type: "FreeUsageLimitError", message: "Free usage exceeded" },
        }),
      },
    }

    expect(sessionErrorMessage(error, "en")).toBe(
      "Free usage is exhausted and will reset in 15 minutes. Switch to another provider or upgrade to HyperCode Go.",
    )
  })

  test("formats exhausted free usage without a valid reset duration", () => {
    const error = {
      name: "APIError",
      data: {
        message: "Free usage exceeded",
        responseHeaders: { "retry-after": "invalid" },
        responseBody: JSON.stringify({
          type: "error",
          error: { type: "FreeUsageLimitError", message: "Free usage exceeded" },
        }),
      },
    }

    expect(sessionErrorMessage(error, "zh")).toBe(
      "免费额度已用完。你可以切换到其他 Provider，或升级 HyperCode Go。",
    )
  })
})
