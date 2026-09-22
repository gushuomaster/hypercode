/** @jsxImportSource @opentui/solid */
import { afterEach, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { setLocale } from "@opencode-ai/tui/i18n"
import type { PermissionRequest, QuestionRequest } from "@opencode-ai/sdk/v2"
import { createSignal } from "solid-js"
import { RunCommandMenuBody, RUN_COMMAND_PANEL_ROWS } from "@/cli/cmd/run/footer.command"
import { RunQuestionBody } from "@/cli/cmd/run/footer.question"
import { permissionInfo, permissionLabel } from "@/cli/cmd/run/permission.shared"
import { RUN_THEME_FALLBACK } from "@/cli/cmd/run/theme"
import { toolPermissionInfo } from "@/cli/cmd/run/tool"
import type { FooterSubagentTab, RunCommand } from "@/cli/cmd/run/types"

afterEach(() => setLocale("en"))

async function commandFrame(locale: "zh" | "en") {
  setLocale(locale)
  const [commands] = createSignal<RunCommand[] | undefined>([])
  const [subagents] = createSignal<FooterSubagentTab[]>([
    {
      sessionID: "child-1",
      partID: "part-1",
      callID: "call-1",
      label: "Explore",
      description: "Inspect auth flow",
      status: "running",
      lastUpdatedAt: 1,
    },
  ])
  const app = await testRender(
    () => (
      <box width={100} height={RUN_COMMAND_PANEL_ROWS}>
        <RunCommandMenuBody
          theme={() => RUN_THEME_FALLBACK.footer}
          commands={commands}
          subagents={subagents}
          queued={() => [{ messageID: "message-1", partID: "part-1", prompt: { text: "follow up", parts: [] } }]}
          variants={() => ["high"]}
          variantCycle="ctrl+t"
          onClose={() => {}}
          onModel={() => {}}
          onEditor={() => {}}
          onSkill={() => {}}
          onSubagent={() => {}}
          onQueued={() => {}}
          onVariant={() => {}}
          onVariantCycle={() => {}}
          onCommand={() => {}}
          onNew={() => {}}
          onExit={() => {}}
        />
      </box>
    ),
    { width: 100, height: RUN_COMMAND_PANEL_ROWS },
  )

  try {
    await app.renderOnce()
    return app.captureCharFrame()
  } finally {
    app.renderer.destroy()
  }
}

test("localizes the mini command menu without changing command identifiers", async () => {
  const zh = await commandFrame("zh")
  expect(zh).toContain("命令")
  expect(zh).toContain("查看子智能体")
  expect(zh).toContain("管理排队输入")
  expect(zh).toContain("/editor")

  const en = await commandFrame("en")
  expect(en).toContain("Commands")
  expect(en).toContain("View subagents")
  expect(en).toContain("Manage queued prompts")
  expect(en).toContain("/editor")
})

test("localizes permission copy while preserving tool and path identifiers", () => {
  const request = {
    id: "permission-1",
    sessionID: "session-1",
    permission: "external_directory",
    patterns: ["/tmp/work/**/*.ts"],
    metadata: {},
    always: [],
  } satisfies PermissionRequest

  setLocale("zh")
  expect(permissionInfo(request).title).toBe("访问外部目录 /tmp/work")
  expect(permissionLabel("once")).toBe("允许一次")
  expect(toolPermissionInfo("grep", { pattern: "TODO" }, {}, [])).toMatchObject({
    title: 'Grep "TODO"',
    lines: ["模式：TODO"],
  })

  setLocale("en")
  expect(permissionInfo(request).title).toBe("Access external directory /tmp/work")
  expect(permissionLabel("once")).toBe("Allow once")
  expect(toolPermissionInfo("grep", { pattern: "TODO" }, {}, [])).toMatchObject({
    title: 'Grep "TODO"',
    lines: ["Pattern: TODO"],
  })
})

test("localizes the question controls while preserving authored question text", async () => {
  setLocale("zh")
  const request = {
    id: "question-1",
    sessionID: "session-1",
    questions: [
      {
        question: "Which answer?",
        header: "Answer",
        options: [{ label: "Provided", description: "Use the listed answer." }],
        custom: true,
      },
    ],
  } satisfies QuestionRequest
  const app = await testRender(
    () => (
      <box width={100} height={16}>
        <RunQuestionBody request={request} theme={RUN_THEME_FALLBACK.footer} onReply={() => {}} onReject={() => {}} />
      </box>
    ),
    { width: 100, height: 16 },
  )

  try {
    await app.renderOnce()
    const frame = app.captureCharFrame()
    expect(frame).toContain("Which answer?")
    expect(frame).toContain("自定义答案")
    expect(frame).toContain("关闭")
  } finally {
    app.renderer.destroy()
  }
})
