// HyperCode has no online update channel (openspec product-default-policy:
// "交付版不使用 upstream 更新渠道"). These guard against an upstream sync bringing back
// update checks, the /update prompt, or installs from the upstream release channel.
import { describe, expect, test } from "bun:test"
import path from "path"
import { Effect } from "effect"
import { Brand } from "../../src/brand"
import { upgrade } from "../../src/cli/upgrade"
import { cliIt } from "../lib/cli-process"

// The harness disables auto-update by default; HyperCode must stay off without that help.
const updatesAllowed = { OPENCODE_DISABLE_AUTOUPDATE: "", HYPERCODE_DISABLE_AUTOUPDATE: "" }

describe("HyperCode update channel", () => {
  test("has no update channel", () => {
    expect(Brand.updateChannel).toBeUndefined()
  })

  test("never checks upstream for updates, so the TUI never prompts or advertises OpenCode 2", async () => {
    expect(await upgrade()).toBeUndefined()
  })

  // Upstream registers /update in app.tsx whenever an updater exists; a sync that brings the block back must fail here.
  test("TUI never registers /update", async () => {
    const app = await Bun.file(path.join(import.meta.dir, "..", "..", "..", "tui", "src", "app.tsx")).text()
    expect(app).toContain("UpdateNotificationProvider")
    expect(app).not.toMatch(/slashName:\s*"update"/)
  })

  cliIt.live(
    "upgrade refuses with a localized message instead of installing from upstream",
    ({ opencode }) =>
      Effect.gen(function* () {
        const zh = yield* opencode.spawn(["upgrade"], { env: { ...updatesAllowed, LANG: "zh_CN.UTF-8" } })
        opencode.expectExit(zh, 1, "upgrade (zh)")
        expect(zh.stderr).toContain("HyperCode 没有在线更新渠道，请向管理员获取新的安装包。")

        const en = yield* opencode.spawn(["upgrade", "--major"], { env: { ...updatesAllowed, LANG: "en_US.UTF-8" } })
        opencode.expectExit(en, 1, "upgrade --major (en)")
        expect(en.stderr).toContain("HyperCode has no online update channel.")
        expect(en.stdout + en.stderr).not.toContain("OpenCode 2")

        const help = yield* opencode.spawn(["upgrade", "--help"], { env: { LANG: "en_US.UTF-8" } })
        opencode.expectExit(help, 0, "upgrade --help")
        expect(help.stdout + help.stderr).not.toContain("OpenCode 2")
      }),
    60_000,
  )

  cliIt.live(
    "help does not advertise upgrade",
    ({ opencode }) =>
      Effect.gen(function* () {
        const help = yield* opencode.spawn(["--help"], { env: { LANG: "en_US.UTF-8" } })
        opencode.expectExit(help, 0, "--help")
        expect(help.stdout + help.stderr).not.toMatch(/\bupgrade\b/)
      }),
    60_000,
  )
})
