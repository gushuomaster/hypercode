import { expect, test } from "bun:test"
import { deriveProductSkillCatalog } from "../src"

test("classifies POSIX skill sources without treating path prefixes as directory boundaries", () => {
  expect(
    deriveProductSkillCatalog({
      workspaceRoots: ["/work/app"],
      home: "/home/alice",
      skills: [
        { name: "project", location: "/work/app/.hypercode/skills/project/SKILL.md" },
        { name: "prefix", location: "/work/application/.hypercode/skills/prefix/SKILL.md" },
        { name: "global", location: "/home/alice/.hypercode/skills/global/SKILL.md" },
        { name: "builtin", location: "<built-in>" },
        { name: "remote", location: "https://example.com/skills/remote/SKILL.md" },
        { name: "unknown" },
      ],
    }).items.map((item) => ({ name: item.name, scope: item.scope, textKey: item.textKey })),
  ).toEqual([
    { name: "project", scope: "project", textKey: "skill.scope.project" },
    { name: "global", scope: "global", textKey: "skill.scope.global" },
    { name: "builtin", scope: "builtin", textKey: "skill.scope.builtin" },
    { name: "prefix", scope: "external", textKey: "skill.scope.external" },
    { name: "remote", scope: "external", textKey: "skill.scope.external" },
    { name: "unknown", scope: "external", textKey: "skill.scope.external" },
  ])
})

test("matches Windows paths case-insensitively and preserves directory boundaries", () => {
  expect(
    deriveProductSkillCatalog({
      workspaceRoots: ["d:\\project\\app\\"],
      home: "C:\\Users\\Alice",
      skills: [
        { name: "project", location: "D:\\Project\\App\\.hypercode\\skills\\project\\SKILL.md" },
        { name: "prefix", location: "D:\\Project\\Application\\skills\\prefix\\SKILL.md" },
        { name: "global", location: "c:\\users\\alice\\.hypercode\\skills\\global\\SKILL.md" },
      ],
    }).items.map((item) => ({ name: item.name, scope: item.scope })),
  ).toEqual([
    { name: "project", scope: "project" },
    { name: "global", scope: "global" },
    { name: "prefix", scope: "external" },
  ])
})

test("deduplicates by canonical precedence and sorts groups and names deterministically", () => {
  const catalog = deriveProductSkillCatalog({
    workspaceRoots: ["/work/app"],
    home: "/home/alice",
    skills: [
      { name: "zebra", location: "/work/app/skills/zebra/SKILL.md" },
      { name: "shared", location: "<built-in>" },
      { name: "alpha", location: "/work/app/skills/alpha/SKILL.md" },
      { name: "shared", location: "https://example.com/shared/SKILL.md" },
      { name: "shared", location: "/home/alice/skills/shared/SKILL.md" },
      { name: "shared", location: "/work/app/skills/shared/SKILL.md" },
      { name: "base", location: "<built-in>" },
      { name: "other", location: "https://example.com/other/SKILL.md" },
    ],
  })

  expect(catalog.items.map((item) => item.name)).toEqual(["alpha", "shared", "zebra", "base", "other"])
  expect(catalog.groups.map((group) => ({ scope: group.scope, names: group.items.map((item) => item.name) }))).toEqual([
    { scope: "project", names: ["alpha", "shared", "zebra"] },
    { scope: "builtin", names: ["base"] },
    { scope: "external", names: ["other"] },
  ])
  expect(catalog.items.find((item) => item.name === "shared")).toEqual({
    name: "shared",
    location: "/work/app/skills/shared/SKILL.md",
    scope: "project",
    textKey: "skill.scope.project",
    overrides: ["global", "external", "builtin"],
  })
})
