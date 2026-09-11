import { describe, expect, test } from "bun:test"
import { prepareAgentMention } from "../../src/prompt/agent"

describe("prepareAgentMention", () => {
  test("inserts into an empty prompt", () => {
    expect(prepareAgentMention("", "general", 0, 0)).toEqual({
      text: "@general ",
      source: { start: 0, end: 8, value: "@general" },
    })
  })

  test("separates a mention inserted between text", () => {
    expect(prepareAgentMention("fixbug", "general", 3, 3)).toEqual({
      text: " @general ",
      source: { start: 4, end: 12, value: "@general" },
    })
  })

  test("does not duplicate surrounding whitespace", () => {
    expect(prepareAgentMention("fix  bug", "explore", 4, 4)).toEqual({
      text: "@explore",
      source: { start: 4, end: 12, value: "@explore" },
    })
  })

  test("uses display offsets after wide characters", () => {
    expect(prepareAgentMention("修复", "general", 4, 4)).toEqual({
      text: " @general ",
      source: { start: 5, end: 13, value: "@general" },
    })
  })

  test("replaces an autocomplete query", () => {
    expect(prepareAgentMention("@gen", "general", 0, 4)).toEqual({
      text: "@general ",
      source: { start: 0, end: 8, value: "@general" },
    })
  })
})
