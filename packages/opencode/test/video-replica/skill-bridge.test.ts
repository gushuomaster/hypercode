import { describe, expect, it } from "bun:test"
import path from "node:path"
import { createSkillBridge, type CommandResult } from "@/video-replica/skill-bridge"

const skillRoot = path.resolve("C:/skills/doubao-video-replica")

function runner(calls: string[][], result: Partial<CommandResult> = {}) {
  return async (command: readonly string[]) => {
    calls.push([...command])
    return {
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      ...result,
    }
  }
}

describe("VideoReplica skill bridge", () => {
  it("invokes only documented scripts with the skill directory as the source", async () => {
    const calls: string[][] = []
    const bridge = createSkillBridge({
      skillLocation: path.join(skillRoot, "SKILL.md"),
      run: runner(calls),
      platform: "win32",
    })

    await bridge.initProject!({
      outputDirectory: "C:\\work\\replica",
      productName: "Widget",
      referenceVideo: "C:\\input\\reference.mp4",
      productImages: ["C:\\input\\product.png"],
    })

    expect(calls[0]).toEqual([
      "python",
      path.join(skillRoot, "scripts", "init_project.py"),
      "C:\\work\\replica",
      "--product-name",
      "Widget",
      "--reference-video",
      "C:\\input\\reference.mp4",
      "--product-image",
      "C:\\input\\product.png",
    ])
    expect(calls[0]?.join(" ")).not.toContain("generation_pipeline.py")
  })

  it("rejects an undocumented script instead of executing arbitrary skill code", async () => {
    const calls: string[][] = []
    const bridge = createSkillBridge({
      skillLocation: path.join(skillRoot, "SKILL.md"),
      run: runner(calls),
      platform: "win32",
    })

    await expect(bridge.runScript!("generation_pipeline.py", [])).rejects.toThrow("not allowed")
    expect(calls).toHaveLength(0)
  })

  it("reports missing tool dependencies without installing anything", async () => {
    const calls: string[][] = []
    const bridge = createSkillBridge({
      skillLocation: path.join(skillRoot, "SKILL.md"),
      run: runner(calls, { exitCode: 1, stderr: "not found" }),
      platform: "win32",
    })

    await expect(bridge.checkDependencies!()).rejects.toThrow("ffmpeg")
    expect(calls.some((command) => command.includes("pip"))).toBe(false)
  })
})
