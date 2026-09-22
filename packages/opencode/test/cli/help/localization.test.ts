import { expect } from "bun:test"
import { Effect } from "effect"
import path from "node:path"
import { mkdir } from "node:fs/promises"
import { cliIt } from "../../lib/cli-process"

function configure(home: string, language: "zh" | "en") {
  const directory = path.join(home, ".config", "opencode")
  return Effect.promise(async () => {
    await mkdir(directory, { recursive: true })
    await Bun.write(path.join(directory, "tui.json"), JSON.stringify({ language }))
  })
}

cliIt.live(
  "localizes framework headings and command help without changing syntax",
  ({ home, opencode }) =>
    Effect.gen(function* () {
      yield* configure(home, "zh")
      const zhMcp = yield* opencode.spawn(["mcp", "--help"], { env: { COLUMNS: "120" } })
      expect(zhMcp.exitCode).toBe(0)
      expect(zhMcp.stderr).toContain("管理 MCP（模型上下文协议）服务器")

      const zh = yield* opencode.spawn(["mcp", "add", "--help"], { env: { COLUMNS: "120" } })
      expect(zh.exitCode).toBe(0)
      expect(zh.stderr).toContain("添加 MCP 服务器")
      expect(zh.stderr).toContain("显示帮助")
      expect(zh.stderr).toContain("位置参数：")
      expect(zh.stderr).toContain("选项：")
      expect(zh.stderr).toContain("hypercode mcp add [name]")

      yield* configure(home, "en")
      const enMcp = yield* opencode.spawn(["mcp", "--help"], { env: { COLUMNS: "120" } })
      expect(enMcp.exitCode).toBe(0)
      expect(enMcp.stderr).toContain("manage MCP (Model Context Protocol) servers")

      const en = yield* opencode.spawn(["mcp", "add", "--help"], { env: { COLUMNS: "120" } })
      expect(en.exitCode).toBe(0)
      expect(en.stderr).toContain("add an MCP server")
      expect(en.stderr).toContain("show help")
      expect(en.stderr).toContain("Positionals:")
      expect(en.stderr).toContain("Options:")
      expect(en.stderr).toContain("hypercode mcp add [name]")
    }),
  60_000,
)
