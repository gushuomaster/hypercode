import { describe, expect, test } from "bun:test"
import { buildTargetName, resolveBuildTargets } from "../../script/target"

describe("build targets", () => {
  test("selects multiple explicit targets without duplicates", () => {
    expect(
      resolveBuildTargets({
        targets: ["linux-x64", "linux-x64-baseline", "linux-x64"],
        single: false,
        baseline: false,
        platform: "win32",
        arch: "x64",
      }).map(buildTargetName),
    ).toEqual(["linux-x64", "linux-x64-baseline"])
  })

  test("rejects unsupported explicit targets", () => {
    expect(() =>
      resolveBuildTargets({
        targets: ["ubuntu-x64"],
        single: false,
        baseline: false,
        platform: "win32",
        arch: "x64",
      }),
    ).toThrow("Unsupported build target: ubuntu-x64")
  })

  test("rejects explicit targets combined with single or baseline", () => {
    expect(() =>
      resolveBuildTargets({
        targets: ["linux-x64"],
        single: true,
        baseline: false,
        platform: "win32",
        arch: "x64",
      }),
    ).toThrow("--target cannot be combined with --single")

    expect(() =>
      resolveBuildTargets({
        targets: ["linux-x64"],
        single: false,
        baseline: true,
        platform: "win32",
        arch: "x64",
      }),
    ).toThrow("--target cannot be combined with --baseline")
  })

  test("preserves native single target selection", () => {
    expect(
      resolveBuildTargets({
        single: true,
        baseline: false,
        platform: "win32",
        arch: "x64",
      }).map(buildTargetName),
    ).toEqual(["windows-x64"])

    expect(
      resolveBuildTargets({
        single: true,
        baseline: true,
        platform: "win32",
        arch: "x64",
      }).map(buildTargetName),
    ).toEqual(["windows-x64", "windows-x64-baseline"])
  })
})
