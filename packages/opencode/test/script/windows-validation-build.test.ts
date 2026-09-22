import { describe, expect, test } from "bun:test"

describe("Windows validation build", () => {
  test("uses the package version while preserving the isolated dev channel", async () => {
    const script = await import("../../../../script/build-windows-validation").catch(() => undefined)

    expect(
      script?.validationBuildEnvironment("1.18.30", {
        OPENCODE_VERSION: "0.0.0-old",
        OPENCODE_CHANNEL: "latest",
        PATH: "C:\\tools",
      }),
    ).toEqual({
      OPENCODE_VERSION: "1.18.30",
      OPENCODE_CHANNEL: "dev",
      PATH: "C:\\tools",
    })
  })

  test("rejects an executable built with a different version", async () => {
    const script = await import("../../../../script/build-windows-validation").catch(() => undefined)

    expect(() => script?.requireBuiltVersion("1.18.30", "0.0.0-dev-202609200308\n")).toThrow(
      "Expected HyperCode 1.18.30, received 0.0.0-dev-202609200308",
    )
  })
})
