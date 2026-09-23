import assert from "node:assert/strict"
import { beforeEach, describe, test } from "node:test"

import { composerRunningState } from "./composer-running-state"
import { setLocale } from "../../../i18n"

describe("composerRunningState", () => {
  beforeEach(() => setLocale("zh"))

  test("maps a busy session to the default thinking interrupt state", () => {
    assert.deepEqual(composerRunningState("running", false), {
      label: "思考中",
      hint: "按 Esc 键中断",
      tone: "running",
      icon: "stop",
      title: "中断当前会话",
      ariaLabel: "中断当前会话",
    })
  })

  test("maps a retry session to a retrying status strip", () => {
    assert.deepEqual(composerRunningState("retry", false), {
      label: "重试中",
      hint: "按 Esc 键中断",
      tone: "retry",
      icon: "stop",
      title: "中断当前会话",
      ariaLabel: "中断当前会话",
    })
  })

  test("arms the interrupt confirmation after the first escape press", () => {
    assert.deepEqual(composerRunningState("running", true), {
      label: "思考中",
      hint: "再按 Esc 键中断",
      tone: "armed",
      icon: "stop-confirm",
      title: "再次按下以中断",
      ariaLabel: "立即中断当前会话",
    })
  })

  test("returns nothing when the session is idle", () => {
    assert.equal(composerRunningState("idle", false), undefined)
  })
})
