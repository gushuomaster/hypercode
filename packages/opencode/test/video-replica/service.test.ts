import { describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createVideoReplicaService, APPROVAL_PHRASE, type SkillBridgeLike } from "@/video-replica/service"

async function makeProject() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hypercode-video-replica-"))
  const referenceVideo = path.join(directory, "reference.mp4")
  const productImage = path.join(directory, "product.png")
  await fs.writeFile(referenceVideo, "video")
  await fs.writeFile(productImage, "image")
  return { directory, referenceVideo, productImage }
}

function bridgeFor(manifest: Record<string, unknown>): SkillBridgeLike {
  return {
    checkDependencies: async () => ({ missing: [], checked: [] }),
    runVisualAsset: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    initProject: async (input) => {
      await fs.mkdir(input.outputDirectory, { recursive: true })
      await fs.writeFile(
        path.join(input.outputDirectory, "project-state.json"),
        JSON.stringify({ schema_version: 1, segments: manifest.segments ?? [] }),
      )
      return { exitCode: 0, stdout: "", stderr: "" }
    },
    inspectVideo: async () => manifest,
    compileDelivery: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  }
}

describe("VideoReplica workflow service", () => {
  it("stops before generation until the exact storyboard approval answer is received", async () => {
    const project = await makeProject()
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 }),
    })
    const run = service.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory: path.join(project.directory, "output"),
      productName: "Widget",
    })

    expect(await run.nextQuestion()).toMatchObject({ questions: [{ header: "批准分镜" }] })
    await expect(run.generate()).rejects.toThrow(APPROVAL_PHRASE)
  })

  it("rejects duplicate semantic segment IDs from analysis", async () => {
    const project = await makeProject()
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ segments: [{ segment_id: "seg-1" }, { segment_id: "seg-1" }], duration_seconds: 4 }),
    })
    const run = service.start({ referenceVideo: project.referenceVideo, productImages: [project.productImage], outputDirectory: path.join(project.directory, "output") })
    await expect(run.nextQuestion()).rejects.toThrow("duplicate semantic segment")
  })

  it("derives semantic segments from visual evidence through the configured segmenter", async () => {
    const project = await makeProject()
    let receivedManifest: Record<string, unknown> | undefined
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ duration_seconds: 4, artifacts: { scene_candidates: [{ timestamp_seconds: 1.25 }] } }),
      semanticSegmenter: async (input) => {
        receivedManifest = input.manifest
        return [{ segment_id: "seg-derived", source_start_seconds: 0, source_end_seconds: 2 }]
      },
    })
    const run = service.start({ referenceVideo: project.referenceVideo, productImages: [project.productImage], outputDirectory: path.join(project.directory, "output") })
    const question = await run.nextQuestion()
    expect(question.questions[0]?.presentation?.facts).toEqual(expect.arrayContaining([{ label: "分段数", value: "1" }]))
    expect(receivedManifest).toMatchObject({ manifests: [{ artifacts: { scene_candidates: [{ timestamp_seconds: 1.25 }] } }] })
    expect(run.segmentIDs).toEqual(["seg-derived"])
    const state = JSON.parse(await fs.readFile(path.join(run.outputDirectory, "project-state.json"), "utf8"))
    expect(state.segments).toMatchObject([{ segment_id: "seg-derived" }])
  })

  it("blocks when inspection has no semantic segments and no segmenter is configured", async () => {
    const project = await makeProject()
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ duration_seconds: 4, artifacts: { scene_candidates: [{ timestamp_seconds: 1.25 }] } }),
    })
    const run = service.start({ referenceVideo: project.referenceVideo, productImages: [project.productImage], outputDirectory: path.join(project.directory, "output") })
    await expect(run.nextQuestion()).rejects.toThrow("configure a semantic segmenter")
  })

  it("requires an explicit exact storyboard approval answer", async () => {
    const project = await makeProject()
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 }),
    })
    const run = service.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory: path.join(project.directory, "output"),
    })

    await run.nextQuestion()
    await expect(run.approveStoryboard(["seg-1"], undefined)).rejects.toThrow(APPROVAL_PHRASE)
    await expect(run.approveStoryboard(["seg-1"], "批准分镜，开始生成首帧图片")).rejects.toThrow(APPROVAL_PHRASE)
    await expect(run.approveStoryboard(["seg-1"], "好的")).rejects.toThrow(APPROVAL_PHRASE)
    expect((await run.nextQuestion()).questions[0]?.header).toBe("批准分镜")
  })

  it("runs the visual-asset entry, inspection, mapping, and freeze phases through public scripts", async () => {
    const project = await makeProject()
    const calls: string[] = []
    const bridge: SkillBridgeLike = {
      ...bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 }),
      runVisualAsset: async (script, args) => {
        calls.push(`${script}:${args.join("|")}`)
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    }
    const service = createVideoReplicaService({ platform: "win32", bridge })
    const run = service.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory: path.join(project.directory, "output"),
    })

    await run.nextQuestion()
    await run.approveStoryboard(["seg-1"], APPROVAL_PHRASE)
    expect(calls.map((item) => item.split(":", 1)[0])).toEqual([
      "configure_visual_assets.py",
      "configure_visual_assets.py",
      "configure_visual_assets.py",
    ])
    expect(calls[0]).toContain("follow-source")
    expect(calls[1]).toContain("apply-mapping")
    expect(calls[2]).toContain("freeze")
  })

  it("persists only the hypercode namespace and resumes without repeat attempts", async () => {
    const project = await makeProject()
    const outputDirectory = path.join(project.directory, "output")
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 }),
    })
    const run = service.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory,
      productName: "Widget",
    })
    await run.nextQuestion()
    await service.approveStoryboard(run.workflowID, ["seg-1"], APPROVAL_PHRASE)
    const state = JSON.parse(await fs.readFile(path.join(outputDirectory, "project-state.json"), "utf8"))
    expect(Object.keys(state)).toEqual(["schema_version", "segments", "hypercode"])
    expect(state.hypercode.checkpoint.phase).toBe("generation")

    const resumed = await service.resume(run.workflowID)
    expect(resumed.providerAttempts).not.toContainEqual(expect.objectContaining({ status: "repeat" }))
  })

  it("splits a long reference into chapters no longer than sixty seconds", async () => {
    const project = await makeProject()
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 121 }),
    })
    const run = service.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory: path.join(project.directory, "output"),
      productName: "Widget",
    })
    await run.nextQuestion()
    expect(run.chapters.every((chapter) => chapter.durationSeconds <= 60)).toBe(true)
    expect(run.chapters).toHaveLength(3)
  })

  it("keeps every segment when accepting frames one at a time before delivery", async () => {
    const project = await makeProject()
    const outputDirectory = path.join(project.directory, "output")
    const acceptedPayloads: Array<Record<string, string>> = []
    const bridge: SkillBridgeLike = {
      ...bridgeFor({
        segments: [{ segment_id: "seg-1" }, { segment_id: "seg-2" }],
        duration_seconds: 4,
      }),
      compileDelivery: async (input) => {
        acceptedPayloads.push(JSON.parse(await fs.readFile(input.accepted!, "utf8")) as Record<string, string>)
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    }
    const service = createVideoReplicaService({
      platform: "win32",
      bridge,
      generateImage: async (input) => {
        const filePath = path.join(input.outputDirectory, `${input.segmentID}.png`)
        await fs.writeFile(filePath, "image")
        return { segmentID: input.segmentID, filePath, provider: "nvidia", model: "qwen/qwen-image-edit" }
      },
    })
    const run = service.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory,
      productName: "Widget",
    })

    await run.nextQuestion()
    await run.approveStoryboard(["seg-1", "seg-2"], APPROVAL_PHRASE)
    await run.generate()
    const afterFirst = await service.acceptImage(run.workflowID, "seg-1", "accepted")
    expect(afterFirst.segmentIDs).toEqual(["seg-1", "seg-2"])
    const afterSecond = await service.acceptImage(run.workflowID, "seg-2", "accepted")
    expect(afterSecond.segmentIDs).toEqual(["seg-1", "seg-2"])
    await service.compileDelivery(run.workflowID)

    expect(acceptedPayloads).toHaveLength(1)
    expect(Object.keys(acceptedPayloads[0]!)).toEqual(["seg-1", "seg-2"])
  })

  it("retries quality once and persists each quality decision", async () => {
    const project = await makeProject()
    const outputDirectory = path.join(project.directory, "output")
    let qualityCalls = 0
    const service = createVideoReplicaService({
      platform: "win32",
      bridge: bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 }),
      generateImage: async (input) => {
        const filePath = path.join(input.outputDirectory, `${input.segmentID}-${crypto.randomUUID()}.png`)
        await fs.writeFile(filePath, "image")
        return { segmentID: input.segmentID, filePath, provider: "nvidia", model: "qwen/qwen-image-edit" }
      },
      qualityCheck: async () => {
        qualityCalls++
        return qualityCalls === 1 ? { status: "uncertain" as const, reason: "logo unclear" } : { status: "accepted" as const }
      },
    })
    const run = service.start({ referenceVideo: project.referenceVideo, productImages: [project.productImage], outputDirectory })
    await run.nextQuestion()
    await run.approveStoryboard(["seg-1"], APPROVAL_PHRASE)
    const result = await run.generate()
    expect(result.generated).toHaveLength(1)
    expect(qualityCalls).toBe(2)
    const state = JSON.parse(await fs.readFile(path.join(outputDirectory, "project-state.json"), "utf8"))
    expect(state.hypercode.quality_checks).toMatchObject([
      { segment_id: "seg-1", status: "uncertain", reason: "logo unclear", attempt: 0 },
      { segment_id: "seg-1", status: "accepted", attempt: 1 },
    ])
  })

  it("resumes from a persisted workflow index in a fresh service instance", async () => {
    const project = await makeProject()
    const outputRoot = project.directory
    const outputDirectory = path.join(outputRoot, "output")
    const bridge = bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 })
    const firstService = createVideoReplicaService({ platform: "win32", bridge, outputRoots: [outputRoot] })
    const firstRun = firstService.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory,
    })
    await firstRun.nextQuestion()
    expect(await fs.stat(path.join(outputDirectory, ".hypercode", "workflow-index.json"))).toBeTruthy()

    const secondService = createVideoReplicaService({ platform: "win32", bridge, outputRoots: [outputRoot] })
    const resumed = await secondService.resume(firstRun.workflowID)
    expect(resumed.workflowID).toBe(firstRun.workflowID)
    expect(resumed.outputDirectory).toBe(outputDirectory)
  })

  it("revalidates platform and media before resuming a persisted workflow", async () => {
    const project = await makeProject()
    const outputRoot = project.directory
    const outputDirectory = path.join(outputRoot, "output")
    const bridge = bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 })
    const firstService = createVideoReplicaService({ platform: "win32", bridge, outputRoots: [outputRoot] })
    const firstRun = firstService.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory,
    })
    await firstRun.nextQuestion()
    await fs.rm(project.referenceVideo)

    const secondService = createVideoReplicaService({ platform: "linux", bridge, outputRoots: [outputRoot] })
    await expect(secondService.resume(firstRun.workflowID)).rejects.toThrow("Windows")
  })

  it("creates a style pack through the manager and applies the registered version", async () => {
    const project = await makeProject()
    const calls: Array<{ script: string; args: ReadonlyArray<string> }> = []
    const bridge: SkillBridgeLike = {
      ...bridgeFor({ segments: [{ segment_id: "seg-1" }], duration_seconds: 4 }),
      createVisualAssetPack: async (input) => {
        calls.push({ script: "manage_visual_assets.py", args: ["create-pack", input.packID] })
        return { pack_id: input.packID, version: 3, name: input.name }
      },
      listVisualAssetPacks: async () => [{ pack_id: "new-pack", version: 3, name: "New pack" }],
      runVisualAsset: async (script, args) => {
        calls.push({ script, args })
        if (script === "configure_visual_assets.py" && args.includes("select-pack")) {
          const statePath = args[args.indexOf("--project-state") + 1]!
          const state = JSON.parse(await fs.readFile(statePath, "utf8"))
          state.visual_assets = { mode: "pack", pack_snapshot: { pack_id: "new-pack", version: 3 } }
          await fs.writeFile(statePath, JSON.stringify(state))
        }
        return { exitCode: 0, stdout: "", stderr: "" }
      },
    }
    const service = createVideoReplicaService({ platform: "win32", bridge })
    const run = service.start({
      referenceVideo: project.referenceVideo,
      productImages: [project.productImage],
      outputDirectory: path.join(project.directory, "output"),
    })

    await run.nextQuestion()
    await run.selectVisualAssets({
      mode: "create-pack",
      packID: "new-pack",
      name: "New pack",
      layersPath: path.join(project.directory, "layers.json"),
      propsPath: path.join(project.directory, "props.json"),
      globalOperationsPath: path.join(project.directory, "operations.json"),
      negativeRulesPath: path.join(project.directory, "negative.json"),
    })

    expect(calls.some((call) => call.script === "manage_visual_assets.py")).toBe(true)
    expect(calls.some((call) => call.script === "configure_visual_assets.py" && call.args.includes("select-pack"))).toBe(true)
    const state = JSON.parse(await fs.readFile(path.join(project.directory, "output", "project-state.json"), "utf8"))
    expect(state.visual_assets.mode).toBe("pack")
    expect(state.visual_assets.pack_snapshot.version).toBe(3)
  })
})
