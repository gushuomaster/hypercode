import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { composerRunningState } from "./composer-running-state"

describe("composerRunningState", () => {
  test("maps a busy session to the default thinking interrupt state", () => {
    assert.deepEqual(composerRunningState({ type: "busy" }, false), {
      label: "思考中",
      hint: "按 Esc 键中断",
      tone: "running",
      icon: "stop",
      title: "中断当前会话",
      ariaLabel: "中断当前会话",
    })
  })

  test("maps a retry session to a retrying status strip", () => {
    assert.deepEqual(composerRunningState({ type: "retry", attempt: 2, message: "Waiting to retry", next: Date.now() }, false), {
      label: "重试中",
      hint: "按 Esc 键中断",
      tone: "retry",
      icon: "stop",
      title: "中断当前会话",
      ariaLabel: "中断当前会话",
    })
  })

  test("arms the interrupt confirmation after the first escape press", () => {
    assert.deepEqual(composerRunningState({ type: "busy" }, true), {
      label: "思考中",
      hint: "再按 Esc 键中断",
      tone: "armed",
      icon: "stop-confirm",
      title: "再次按下以中断",
      ariaLabel: "立即中断当前会话",
    })
  })

  test("returns nothing when the session is idle", () => {
    assert.equal(composerRunningState({ type: "idle" }, false), undefined)
  })
})
