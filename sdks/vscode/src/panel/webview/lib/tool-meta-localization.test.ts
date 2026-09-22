import assert from "node:assert/strict"
import { test } from "node:test"
import { setLocale } from "../../../i18n"
import { diffSummary, partTitle } from "./part-utils"
import { defaultToolTitle, patchSummary, toolLabel } from "./tool-meta"

test("localizes generated tool labels and file summaries", () => {
  setLocale("zh")

  assert.equal(toolLabel("bash"), "Shell")
  assert.equal(defaultToolTitle("bash", {}, {}), "Shell 命令")
  assert.equal(defaultToolTitle("question", {}, {}), "问题")
  assert.equal(patchSummary("delete", 0, 0, "", "a.ts"), "已删除")
  assert.equal(diffSummary(""), "已修改")
  assert.equal(partTitle({ type: "reasoning" } as never), "推理")
})
