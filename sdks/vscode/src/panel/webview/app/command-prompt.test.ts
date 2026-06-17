import assert from "node:assert/strict"
import { describe, test } from "node:test"

import type { SessionMessage, TextPart } from "../../../core/sdk"
import { captureCommandPromptInvocations, commandPromptLabel, findCommandPromptInvocation, fingerprintCommandPromptText, isCompactCommandPromptText, previewCommandPromptText, shouldTrackCommandPromptInvocation } from "./command-prompt"

function textPart(messageID: string, text: string): TextPart {
  return {
    id: `${messageID}-text`,
    sessionID: "session-1",
    messageID,
    type: "text",
    text,
  }
}

function sessionMessage(id: string, role: "user" | "assistant", text: string): SessionMessage {
  return {
    info: {
      id,
      sessionID: "session-1",
      role,
      time: { created: 1 },
    },
    parts: [textPart(id, text)],
  }
}

const INIT_PROMPT = `Create or update AGENTS.md for this repository.

The goal is a compact instruction file that helps future HyperCode sessions avoid mistakes and ramp up quickly. Every line should answer: "Would an agent likely miss this without help?" If not, leave it out.

# How to investigate

Read the highest-value sources first:

- README, root manifests, workspace config, lockfiles
- build, test, lint, formatter, typecheck, and codegen config
- existing instruction files

# What to extract

Look for the highest-signal facts for an agent working in this repo:

- exact developer commands, especially non-obvious ones
- required command order when it matters
- testing quirks and important constraints
`

describe("isCompactCommandPromptText", () => {
  test("detects long structured prompt-style command text", () => {
    assert.equal(isCompactCommandPromptText(INIT_PROMPT), true)
  })

  test("ignores normal short user prompts", () => {
    assert.equal(isCompactCommandPromptText("甯垜鐪嬬湅杩欎釜缁勪欢"), false)
  })
})

describe("captureCommandPromptInvocations", () => {
  test("binds the next prompt-like user message to the pending slash command", () => {
    const result = captureCommandPromptInvocations([], [sessionMessage("m1", "user", INIT_PROMPT)], [{
      command: "init",
      arguments: "",
    }], {})

    assert.deepEqual(result.pending, [])
    assert.deepEqual(findCommandPromptInvocation(INIT_PROMPT, result.catalog), {
      command: "init",
      arguments: "",
    })
  })

  test("drops non-prompt command messages without keeping stale pending entries", () => {
    const result = captureCommandPromptInvocations([], [sessionMessage("m1", "user", "review src/panel")], [{
      command: "review",
      arguments: "src/panel",
    }], {})

    assert.deepEqual(result.pending, [])
    assert.equal(findCommandPromptInvocation("review src/panel", result.catalog), undefined)
  })
})

describe("findCommandPromptInvocation", () => {
  test("matches exact command templates from the SDK command catalog", () => {
    assert.deepEqual(findCommandPromptInvocation(INIT_PROMPT, {}, [{
      name: "init",
      description: "create/update AGENTS.md",
      template: INIT_PROMPT,
      hints: [],
      source: "command",
    }]), {
      command: "init",
      arguments: "",
    })
  })

  test("matches rendered command prompts after placeholder substitution", () => {
    const template = `Create or update \`AGENTS.md\` for this repository.

User-provided focus or constraints (honor these):
$ARGUMENTS

## How to investigate

Read the highest-value sources first:
- README
- lockfiles`

    const rendered = `Create or update \`AGENTS.md\` for this repository.

User-provided focus or constraints (honor these):

## How to investigate

Read the highest-value sources first:
- README
- lockfiles`

    assert.deepEqual(findCommandPromptInvocation(rendered, {}, [{
      name: "init",
      description: "create/update AGENTS.md",
      template,
      hints: [],
      source: "command",
    }]), {
      command: "init",
      arguments: "",
    })
  })

  test("ignores skill-sourced templates when matching compact command prompts", () => {
    assert.equal(findCommandPromptInvocation(INIT_PROMPT, {}, [{
      name: "article-writing",
      description: "skill entry",
      template: INIT_PROMPT,
      hints: [],
      source: "skill",
    }]), undefined)
  })

  test("ignores persisted catalog matches for skill-sourced commands", () => {
    const fingerprint = fingerprintCommandPromptText(INIT_PROMPT)

    assert.equal(findCommandPromptInvocation(INIT_PROMPT, {
      [fingerprint]: {
        command: "article-writing",
        arguments: "topic",
      },
    }, [{
      name: "article-writing",
      description: "skill entry",
      hints: [],
      source: "skill",
    }]), undefined)
  })
})

describe("shouldTrackCommandPromptInvocation", () => {
  test("does not track skill slash commands for compact command prompts", () => {
    assert.equal(shouldTrackCommandPromptInvocation("article-writing", [{
      name: "article-writing",
      description: "skill entry",
      hints: [],
      source: "skill",
    }]), false)
  })

  test("keeps tracking non-skill or unresolved slash commands", () => {
    assert.equal(shouldTrackCommandPromptInvocation("review", [{
      name: "review",
      description: "review changes",
      hints: [],
      source: "command",
    }]), true)
    assert.equal(shouldTrackCommandPromptInvocation("missing", []), true)
  })
})

describe("commandPromptLabel", () => {
  test("includes command arguments when present", () => {
    assert.equal(commandPromptLabel({
      command: "review",
      arguments: "src/panel",
    }), "review src/panel")
  })
})

describe("previewCommandPromptText", () => {
  test("keeps the leading structure while truncating long prompts", () => {
    const preview = previewCommandPromptText(INIT_PROMPT)

    assert.equal(preview.includes("Create or update AGENTS.md for this repository."), true)
    assert.equal(preview.includes("# How to investigate"), true)
    assert.equal(preview.includes("# What to extract"), false)
    assert.equal(preview.endsWith("..."), true)
  })
})
