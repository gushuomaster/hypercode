import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { buildAgentPickerItems } from "./agent-picker"

describe("buildAgentPickerItems", () => {
  test("groups all visible agents and localizes built-in descriptions", () => {
    const items = buildAgentPickerItems([
      { name: "build", mode: "primary" },
      { name: "plan", mode: "all" },
      { name: "general", mode: "subagent" },
      { name: "hidden", mode: "subagent", hidden: true },
    ], "build", "zh-CN")

    assert.deepEqual(items.map((item) => [item.label, item.group, item.selected]), [
      ["build", "primary", true],
      ["plan", "primary", false],
      ["general", "subagent", false],
    ])
    assert.match(items[0]?.detail ?? "", /开发智能体/)
    assert.match(items[2]?.detail ?? "", /通用子智能体/)
  })

  test("uses custom descriptions and a localized fallback", () => {
    const items = buildAgentPickerItems([
      { name: "reviewer", mode: "subagent", description: "Reviews risky changes" },
      { name: "worker", mode: "subagent" },
    ], undefined, "zh-CN")

    assert.equal(items[0]?.detail, "Reviews risky changes")
    assert.equal(items[1]?.detail, "未配置职责说明。")
  })
})
