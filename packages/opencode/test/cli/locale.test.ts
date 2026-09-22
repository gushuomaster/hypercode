import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveCliLocale } from "@/cli/locale"
import { tmpdir } from "../fixture/fixture"

describe("CLI locale resolution", () => {
  test("prefers the closest explicit TUI config over saved state and environment", async () => {
    await using tmp = await tmpdir()
    const global = path.join(tmp.path, "global-tui.json")
    const project = path.join(tmp.path, "project-tui.jsonc")
    const state = path.join(tmp.path, "kv.json")
    await Bun.write(global, JSON.stringify({ language: "zh" }))
    await Bun.write(project, "{\n  // closest project setting wins\n  \"language\": \"en\",\n}\n")
    await Bun.write(state, JSON.stringify({ language: "zh" }))

    expect(
      await resolveCliLocale({
        configFiles: [global, project],
        stateFile: state,
        environment: { LANG: "zh_CN.UTF-8" },
      }),
    ).toBe("en")
  })

  test("uses saved state when config has no valid language", async () => {
    await using tmp = await tmpdir()
    const config = path.join(tmp.path, "tui.json")
    const state = path.join(tmp.path, "kv.json")
    await Bun.write(config, JSON.stringify({ language: "fr" }))
    await Bun.write(state, JSON.stringify({ language: "zh" }))

    expect(
      await resolveCliLocale({
        configFiles: [config],
        stateFile: state,
        environment: { LANG: "en_US.UTF-8" },
      }),
    ).toBe("zh")
  })

  test("falls back to environment when files are missing or malformed", async () => {
    await using tmp = await tmpdir()
    const config = path.join(tmp.path, "tui.json")
    const state = path.join(tmp.path, "kv.json")
    await Bun.write(config, "{ invalid")
    await Bun.write(state, "{ invalid")

    expect(
      await resolveCliLocale({
        configFiles: [config],
        stateFile: state,
        environment: { LANG: "ja_JP.UTF-8" },
      }),
    ).toBe("en")
  })
})
