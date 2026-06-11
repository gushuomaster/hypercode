import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { composerPrimaryAction } from "./composer-primary-action"

describe("composerPrimaryAction", () => {
  test("disables submit when the composer has no text or image attachments", () => {
    assert.deepEqual(composerPrimaryAction({
      draft: "   ",
      imageCount: 0,
      blocked: false,
      running: false,
      escPending: false,
    }), {
      kind: "submit",
      disabled: true,
      icon: "send",
      title: "回车键发送",
      ariaLabel: "提交提示词",
    })
  })

  test("enables submit when there is draft text", () => {
    assert.deepEqual(composerPrimaryAction({
      draft: "ship it",
      imageCount: 0,
      blocked: false,
      running: false,
      escPending: false,
    }), {
      kind: "submit",
      disabled: false,
      icon: "send",
      title: "回车键发送",
      ariaLabel: "提交提示词",
    })
  })

  test("enables submit when the composer only has image attachments", () => {
    assert.deepEqual(composerPrimaryAction({
      draft: "",
      imageCount: 2,
      blocked: false,
      running: false,
      escPending: false,
    }), {
      kind: "submit",
      disabled: false,
      icon: "send",
      title: "回车键发送",
      ariaLabel: "提交提示词",
    })
  })

  test("switches to interrupt while the session is running", () => {
    assert.deepEqual(composerPrimaryAction({
      draft: "ship it",
      imageCount: 0,
      blocked: false,
      running: true,
      escPending: false,
    }), {
      kind: "interrupt",
      disabled: false,
      icon: "stop",
      title: "中断当前会话",
      ariaLabel: "中断当前会话",
    })
  })

  test("surfaces the second-step interrupt state while escape confirmation is pending", () => {
    assert.deepEqual(composerPrimaryAction({
      draft: "ship it",
      imageCount: 0,
      blocked: false,
      running: true,
      escPending: true,
    }), {
      kind: "interrupt",
      disabled: false,
      icon: "stop-confirm",
      title: "再次按下以中断",
      ariaLabel: "立即中断当前会话",
    })
  })

  test("keeps submit disabled when the composer is blocked", () => {
    assert.deepEqual(composerPrimaryAction({
      draft: "ship it",
      imageCount: 1,
      blocked: true,
      running: false,
      escPending: false,
    }), {
      kind: "submit",
      disabled: true,
      icon: "send",
      title: "提交不可用",
      ariaLabel: "提交提示词",
    })
  })
})
