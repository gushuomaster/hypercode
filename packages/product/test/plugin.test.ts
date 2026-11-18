import { describe, expect, test } from "bun:test"
import { deriveProductPlugins } from "../src"

describe("deriveProductPlugins", () => {
  test("names local plugins by file, or by directory for index files, on any platform", () => {
    expect(deriveProductPlugins([
      "file:///C:/Users/me/.config/hypercode/plugin/notify.ts",
      "file:///home/me/project/.hypercode/plugin/guard/index.js",
      "file:///C:/work/my%20plugin/index.ts",
      "file:///opt/plugins/bare",
    ])).toEqual([
      { name: "bare" },
      { name: "guard" },
      { name: "my plugin" },
      { name: "notify" },
    ])
  })

  test("keeps npm versions, including scoped packages and tuple specs", () => {
    expect(deriveProductPlugins([
      "opencode-wakatime",
      "@acme/audit@1.2.3",
      ["oh-my-plugin@0.4.0", { enabled: true }],
    ])).toEqual([
      { name: "@acme/audit", version: "1.2.3" },
      { name: "oh-my-plugin", version: "0.4.0" },
      { name: "opencode-wakatime", version: "latest" },
    ])
  })

  test("treats missing plugin config as no plugins", () => {
    expect(deriveProductPlugins(undefined)).toEqual([])
  })
})
