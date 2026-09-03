import { describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { matchAndPropose } from "@/video-replica/plus-import"
import { APPROVAL_PHRASE, createVideoReplicaService, type SkillBridgeLike } from "@/video-replica/service"

const makeProject = async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "hypercode-plus-import-"))
  const referenceVideo = path.join(directory, "reference.mp4")
  const productImage = path.join(directory, "product.png")
  await fs.writeFile(referenceVideo, "video")
  await fs.writeFile(productImage, "image")
  return { directory, referenceVideo, productImage }
}

const bridgeFor = (manifest: Record<string, unknown>): SkillBridgeLike => ({
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
})

describe("PlusImport matching", () => {
  it("proposes a filename segment match without accepting it", () => {
    const proposals = matchAndPropose([{ name: "seg-2-plus.png" }])

    expect(proposals[0]).toMatchObject({
      suggestedSegmentID: "seg-2",
      requiresConfirmation: true,
      accepted: false,
    })
  })

  it("uses pending segments as candidates when a filename has no segment ID", () => {
    const proposals = matchAndPropose(
      [{ name: "plus-output.png" }],
      [{ segmentID: "seg-1", pending: true }, { segmentID: "seg-2", pending: true }],
    )

    expect(proposals[0]?.candidates).toEqual(["seg-1", "seg-2"])
    expect(proposals[0]?.suggestedSegmentID).toBeUndefined()
    expect(proposals[0]?.requiresConfirmation).toBe(true)
  })
})

describe("PlusImport workflow confirmation", () => {
  it("does not accept a matched Plus image until explicit confirmation", async () => {
    const project = await makeProject()
    const plusImage = path.join(project.directory, "seg-1-plus.png")
    await fs.writeFile(plusImage, "plus-image")
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
    const proposal = await run.importPlusImage(plusImage)
    expect(proposal.requiresConfirmation).toBe(true)
    expect(proposal.suggestedSegmentID).toBe("seg-1")
    const before = JSON.parse(await fs.readFile(path.join(project.directory, "output", "project-state.json"), "utf8"))
    expect(before.hypercode.approvals.at(-1).decision).toBe("plus-import-proposed")
    expect(before.hypercode.approvals.at(-1).decision).not.toBe("accepted")

    await run.confirmPlusImage("seg-1", "确认映射")
    const after = JSON.parse(await fs.readFile(path.join(project.directory, "output", "project-state.json"), "utf8"))
    expect(after.hypercode.approvals.at(-1).decision).toBe("accepted")
  })

  it("keeps a cancelled Plus mapping pending", async () => {
    const project = await makeProject()
    const plusImage = path.join(project.directory, "seg-1-plus.png")
    await fs.writeFile(plusImage, "plus-image")
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
    await run.importPlusImage(plusImage)
    await run.confirmPlusImage("seg-1", "取消")
    const state = JSON.parse(await fs.readFile(path.join(project.directory, "output", "project-state.json"), "utf8"))
    expect(state.hypercode.approvals.at(-1).decision).toBe("plus-import-proposed")
  })

  it("requires a safe image path when confirming an unmatched proposal", async () => {
    const project = await makeProject()
    const plusImage = path.join(project.directory, "plus-output.png")
    await fs.writeFile(plusImage, "plus-image")
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
    const proposal = await run.importPlusImage(plusImage)
    expect(proposal.suggestedSegmentID).toBeUndefined()
    await expect(run.confirmPlusImage("seg-1", "确认映射")).rejects.toThrow("file path")
    await run.confirmPlusImage({ segmentID: "seg-1", filePath: plusImage, answer: "确认映射" })
    const state = JSON.parse(await fs.readFile(path.join(project.directory, "output", "project-state.json"), "utf8"))
    expect(state.hypercode.approvals.at(-1).decision).toBe("accepted")
  })

  it("keeps the storyboard approval phrase separate from Plus confirmation", () => {
    expect("确认映射").not.toBe(APPROVAL_PHRASE)
  })
})
