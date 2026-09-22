import { describe, expect, test } from "bun:test"
import { alignAutocompleteOptions, commandAutocompleteCopy } from "../../src/component/prompt/autocomplete"

describe("prompt autocomplete command copy", () => {
  test("keeps project and MCP command names free of source labels", () => {
    expect(
      commandAutocompleteCopy(
        {
          name: "commit",
          source: "command",
          description: "commit and push changes",
          description_i18n: { zh: "提交并推送 Git 更改" },
        },
        "zh",
      ),
    ).toEqual({
      display: "/commit",
      description: "提交并推送 Git 更改",
    })
    expect(
      commandAutocompleteCopy(
        {
          name: "overwrite-check:resource-prompt",
          source: "mcp",
          description: "A prompt that includes a resource",
        },
        "zh",
      ),
    ).toEqual({
      display: "/overwrite-check:resource-prompt",
      description: "A prompt that includes a resource",
    })
  })

  test("aligns descriptions by terminal display width", () => {
    expect(
      alignAutocompleteOptions([
        { display: "/commit", description: "提交" },
        { display: "/测试", description: "说明" },
      ]).map((item) => item.display),
    ).toEqual(["/commit  ", "/测试    "])
  })
})
