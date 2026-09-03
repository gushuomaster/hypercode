import { describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createSkillBridge, type CommandResult } from "@/video-replica/skill-bridge"

const skillRoot = path.resolve("C:/skills/doubao-video-replica")

async function makeSkillRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "video-replica-skill-"))
  await fs.mkdir(path.join(root, "scripts"), { recursive: true })
  await fs.writeFile(path.join(root, "SKILL.md"), "---\nname: doubao-video-replica\n---\n")
  await fs.writeFile(path.join(root, "scripts", "init_project.py"), "print('ok')")
  await fs.writeFile(path.join(root, "scripts", "manage_visual_assets.py"), "print('ok')")
  return root
}

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
    const root = await makeSkillRoot()
    const bridge = createSkillBridge({
      skillLocation: path.join(root, "SKILL.md"),
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
      path.join(root, "scripts", "init_project.py"),
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
    const root = await makeSkillRoot()
    const bridge = createSkillBridge({
      skillLocation: path.join(root, "SKILL.md"),
      run: runner(calls),
      platform: "win32",
    })

    await expect(bridge.runScript!("generation_pipeline.py", [])).rejects.toThrow("not allowed")
    expect(calls).toHaveLength(0)
  })

  it("reports missing tool dependencies without installing anything", async () => {
    const calls: string[][] = []
    const root = await makeSkillRoot()
    const bridge = createSkillBridge({
      skillLocation: path.join(root, "SKILL.md"),
      run: runner(calls, { exitCode: 1, stderr: "not found" }),
      platform: "win32",
    })

    await expect(bridge.checkDependencies!()).rejects.toThrow("ffmpeg")
    expect(calls.some((command) => command.includes("pip"))).toBe(false)
  })

  it("validates skill metadata and the requested script even with an injected runner", async () => {
    const calls: string[][] = []
    const bridge = createSkillBridge({
      skillLocation: path.join(skillRoot, "SKILL.md"),
      run: runner(calls),
      platform: "win32",
    })

    await expect(bridge.runScript!("init_project.py", [])).rejects.toThrow("skill directory is unavailable")
    expect(calls).toHaveLength(0)
  })

  it("lists visual packs through the documented manager script", async () => {
    const calls: string[][] = []
    const root = await makeSkillRoot()
    const bridge = createSkillBridge({
      skillLocation: path.join(root, "SKILL.md"),
      run: runner(calls, { stdout: JSON.stringify([{ pack_id: "demo", version: 1 }]) }),
      platform: "win32",
    })

    await expect(bridge.listVisualAssetPacks!("C:\\assets\\replica")).resolves.toEqual([{ pack_id: "demo", version: 1 }])
    expect(calls[0]).toEqual([
      "python",
      path.join(root, "scripts", "manage_visual_assets.py"),
      "--root",
      "C:\\assets\\replica",
      "list-packs",
    ])
  })

  it("creates a visual pack through the documented manager script", async () => {
    const calls: string[][] = []
    const root = await makeSkillRoot()
    const bridge = createSkillBridge({
      skillLocation: path.join(root, "SKILL.md"),
      run: runner(calls, { stdout: JSON.stringify({ pack_id: "demo", version: 1 }) }),
      platform: "win32",
    })

    await expect(
      bridge.createVisualAssetPack!({
        assetRoot: "C:\\assets\\replica",
        packID: "demo",
        name: "Demo",
        layersPath: "C:\\tmp\\layers.json",
        propsPath: "C:\\tmp\\props.json",
        globalOperationsPath: "C:\\tmp\\operations.json",
        negativeRulesPath: "C:\\tmp\\negative.json",
        followSourceLayers: ["hands"],
      }),
    ).resolves.toEqual({ pack_id: "demo", version: 1 })
    expect(calls[0]).toEqual([
      "python",
      path.join(root, "scripts", "manage_visual_assets.py"),
      "--root",
      "C:\\assets\\replica",
      "create-pack",
      "--pack-id",
      "demo",
      "--name",
      "Demo",
      "--layers-json",
      "C:\\tmp\\layers.json",
      "--props-json",
      "C:\\tmp\\props.json",
      "--global-operations-json",
      "C:\\tmp\\operations.json",
      "--negative-rules-json",
      "C:\\tmp\\negative.json",
      "--follow-source-layer",
      "hands",
    ])
  })

  it("does not run skill scripts from a caller-controlled working directory", async () => {
    const roots: Array<string | undefined> = []
    const root = await makeSkillRoot()
    const bridge = createSkillBridge({
      skillLocation: path.join(root, "SKILL.md"),
      run: async (_command, options) => {
        roots.push(options?.cwd)
        return { exitCode: 0, stdout: "", stderr: "" }
      },
      platform: "win32",
    })

    await bridge.runScript!("init_project.py", [], "C:\\untrusted\\working-directory")
    expect(roots).toEqual([root])
  })
})
