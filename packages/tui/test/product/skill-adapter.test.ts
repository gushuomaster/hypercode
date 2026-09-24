import { expect, test } from "bun:test"
import { t } from "../../src/i18n"
import { toTuiSkillCatalog } from "../../src/product/skill-adapter"
import { toTuiTextKey } from "../../src/product/text-adapter"

test("projects skill scopes and localized group labels through Product", () => {
  const catalog = toTuiSkillCatalog({
    workspaceRoots: ["D:\\project\\hypercode"],
    home: "C:\\Users\\Alice",
    skills: [
      { name: "remote", location: "https://example.com/remote/SKILL.md" },
      { name: "builtin", location: "<built-in>" },
      { name: "global", location: "C:\\Users\\Alice\\.hypercode\\skills\\global\\SKILL.md" },
      { name: "project", location: "d:\\PROJECT\\hypercode\\.hypercode\\skills\\project\\SKILL.md" },
    ],
  })

  expect(catalog.items.map((item) => item.name)).toEqual(["project", "global", "builtin", "remote"])
  expect(catalog.groups.map((group) => t(toTuiTextKey(group.textKey), undefined, "zh"))).toEqual([
    "项目 Skills",
    "全局 Skills",
    "内置 Skills",
    "外部 Skills",
  ])
})
