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
    await service.approveStoryboard(run.workflowID, ["seg-1"])
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
    await run.approveStoryboard(["seg-1", "seg-2"])
    await run.generate()
    const afterFirst = await service.acceptImage(run.workflowID, "seg-1", "accepted")
    expect(afterFirst.segmentIDs).toEqual(["seg-1", "seg-2"])
    const afterSecond = await service.acceptImage(run.workflowID, "seg-2", "accepted")
    expect(afterSecond.segmentIDs).toEqual(["seg-1", "seg-2"])
    await service.compileDelivery(run.workflowID)

    expect(acceptedPayloads).toHaveLength(1)
    expect(Object.keys(acceptedPayloads[0]!)).toEqual(["seg-1", "seg-2"])
  })
})
