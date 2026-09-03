import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Question } from "../../src/question"
import { Truncate } from "../../src/tool/truncate"
import { Tool } from "../../src/tool/tool"
import { VideoReplicaTool } from "../../src/tool/video-replica"
import { VideoReplica, APPROVAL_PHRASE, type StoryboardQuestion } from "../../src/video-replica/service"
import { MessageID, SessionID } from "../../src/session/schema"

const ctx = {
  sessionID: SessionID.make("ses_video-replica-tool"),
  messageID: MessageID.make("msg_video-replica-tool"),
  callID: "call_video-replica-tool",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

function makeQuestion(header: string, labels: ReadonlyArray<string>): StoryboardQuestion {
  return {
    questions: [
      {
        question: header,
        header,
        options: labels.map((label) => ({ label, description: label })),
      },
    ],
  }
}

function makeRun(question: StoryboardQuestion, calls: string[]): VideoReplica.WorkflowRun {
  const run: VideoReplica.WorkflowRun = {
    workflowID: "workflow-video-replica-tool",
    outputDirectory: "output",
    segmentIDs: ["seg-1"],
    chapters: [],
    providerAttempts: [],
    nextQuestion: async () => question,
    generate: async () => ({ workflowID: run.workflowID, generated: [], skipped: [], failed: [] }),
    approveStoryboard: async (_segmentIDs, answer) => {
      calls.push(`approve:${answer ?? ""}`)
      return run
    },
    acceptImage: async () => run,
    importPlusImage: async (filePath) => ({ workflowID: run.workflowID, filePath, requiresConfirmation: true }),
    compileDelivery: async () => ({ workflowID: run.workflowID, outputDirectory: run.outputDirectory }),
    selectVisualAssets: async (selection) => {
      calls.push(`assets:${selection.mode}`)
      return run
    },
    confirmModels: async (answer) => {
      calls.push(`models:${answer}`)
      return run
    },
    listVisualAssetPacks: async () => [],
    createVisualAssetPack: async () => run,
  }
  return run
}

function executeResume(run: VideoReplica.WorkflowRun, answer: string) {
  const service = VideoReplica.Service.of({
    start: () => run,
    resume: async () => run,
    approveStoryboard: async () => run,
    acceptImage: async () => run,
    importPlusImage: async (workflowID, filePath) => ({ workflowID, filePath, requiresConfirmation: true }),
    compileDelivery: async (workflowID) => ({ workflowID, outputDirectory: run.outputDirectory }),
    selectVisualAssets: async () => run,
    confirmModels: async () => run,
    listVisualAssetPacks: async () => [],
    createVisualAssetPack: async () => run,
  })

  return Effect.gen(function* () {
    const info = yield* VideoReplicaTool
    const tool = yield* Tool.init(info)
    return yield* tool.execute({ action: "resume", workflowID: run.workflowID }, ctx)
  }).pipe(
    Effect.provide(Layer.succeed(VideoReplica.Service, service)),
    Effect.provide(
      Layer.mock(Question.Service)({
        ask: () => Effect.succeed([[answer]]),
      }),
    ),
    Effect.provide(
      Layer.mock(Truncate.Service)({
        output: (output: string) => Effect.succeed({ content: output, truncated: false }),
      }),
    ),
    Effect.provide(Layer.mock(Agent.Service)({ get: () => Effect.succeed({ name: "build" } as never) })),
  )
}

describe("tool.video_replica resume", () => {
  test("applies a visual asset answer instead of dropping it", async () => {
    const calls: string[] = []
    const run = makeRun(makeQuestion("视觉资产", ["跟随参考视频", "选择已有风格包"]), calls)

    await Effect.runPromise(executeResume(run, "跟随参考视频"))

    expect(calls).toEqual(["assets:follow-source"])
  })

  test("applies a model confirmation answer instead of dropping it", async () => {
    const calls: string[] = []
    const run = makeRun(makeQuestion("确认图片模型", ["确认使用", "取消"]), calls)

    await Effect.runPromise(executeResume(run, "确认使用"))

    expect(calls).toEqual(["models:确认使用"])
  })

  test("keeps the model confirmation gate blocked when the user cancels", async () => {
    const calls: string[] = []
    const run = makeRun(makeQuestion("确认图片模型", ["确认使用", "取消"]), calls)

    const output = await Effect.runPromise(executeResume(run, "取消"))

    expect(calls).toEqual([])
    expect(output.output).toContain("确认图片模型")
  })

  test("returns a follow-up action when a pack choice needs more details", async () => {
    const calls: string[] = []
    const run = makeRun(makeQuestion("视觉资产", ["跟随参考视频", "选择已有风格包"]), calls)

    const output = await Effect.runPromise(executeResume(run, "选择已有风格包"))

    expect(calls).toEqual([])
    expect(output.metadata.status).toBe("selection-required")
    expect(output.output).toContain('"nextAction":"select_visual_assets"')
  })

  test("only applies the exact storyboard approval phrase", async () => {
    const calls: string[] = []
    const run = makeRun(makeQuestion("批准分镜", [APPROVAL_PHRASE]), calls)

    await Effect.runPromise(executeResume(run, APPROVAL_PHRASE))

    expect(calls).toEqual([`approve:${APPROVAL_PHRASE}`])
  })
})
