import { describe, expect, test } from "bun:test"
import path from "path"
import { getLocale, setLocale } from "@opencode-ai/tui/i18n"
import { cliText } from "@/cli/text"

const cli = path.join(import.meta.dir, "..", "..", "src", "cli")
const commands = path.join(import.meta.dir, "..", "..", "..", "..", ".opencode", "command")
const describes = /\b(?:describe|description)\s*:\s*(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g
// demo.ts 是 `run --demo` 的开发演示脚本，其中的 description 是假数据，不是命令说明。
const excluded = new Set(["cmd/run/demo.ts"])
// 白名单只放行技术标识（目前只有 URL，例如 attach 的默认地址）。
const technical = [/^https?:\/\/\S+$/]
// 允许出现中文的 zh/en 字典文件：帮助文案字典、yargs 框架标题、授权提示双语文案。
const dictionaries = new Set(["text.ts", "yargs.ts", "cmd/license.ts"])
const runtime =
  /\b(?:UI\.(?:error|println)|prompts\.(?:log\.(?:error|warn|info|success|message|step)|intro|outro|cancel|note))\(\s*(["'`])([^"'`\n]*[A-Za-z][^"'`\n]*)\1/g
// 已知债务：upstream 命令文件中运行时输出的硬编码英文条数（2026-11-13）。
// 逐条翻译会让这些 upstream 文件在每次同步时冲突，因此先冻结数量防止回退，不在此处翻译。
const runtimeEnglishBaseline = {
  "cmd/agent.ts": 4,
  "cmd/attach.ts": 3,
  "cmd/export.ts": 4,
  "cmd/github.handler.ts": 4,
  "cmd/mcp.ts": 60,
  "cmd/plug.ts": 1,
  "cmd/pr.ts": 3,
  "cmd/run.ts": 11,
  "cmd/tui.ts": 5,
  "cmd/uninstall.ts": 16,
  // v1.19.6 加入 OpenCode 2 安装流程（+5）；HyperCode 没有更新渠道，handler 开头即退出，这些输出不可达。
  "cmd/upgrade.ts": 15,
}

describe("CLI localization audit", () => {
  test("every CLI command and option description has a Chinese translation", async () => {
    const files = (await Array.fromAsync(new Bun.Glob("**/*.{ts,tsx}").scan(cli)))
      .map((file) => file.replaceAll("\\", "/"))
      .filter((file) => !excluded.has(file))
    const entries = (
      await Promise.all(
        files.map(async (file) => {
          const source = await Bun.file(path.join(cli, file)).text()
          return [...source.matchAll(describes)].map((match) => ({
            location: `${file}:${source.slice(0, match.index).split("\n").length}`,
            // 运行时 `${UI.product}` / `${Brand.product}` 先插值成 HyperCode 再查字典。
            value: match[2].replace(/\$\{(?:UI|Brand)\.product\}/g, "HyperCode"),
          }))
        }),
      )
    ).flat()
    const previous = getLocale()
    setLocale("zh")
    const violations = entries
      .filter((entry) => entry.value.match(/[A-Za-z]/))
      .filter((entry) => !technical.some((pattern) => pattern.test(entry.value)))
      .filter((entry) => cliText(entry.value) === entry.value)
      .map((entry) => `${entry.location}: ${entry.value}`)
    setLocale(previous)

    // 下限防止正则失效后审计空转通过。
    expect(entries.length).toBeGreaterThan(100)
    expect(violations).toEqual([])
  })

  test("runtime output does not gain new hardcoded English copy", async () => {
    const files = (await Array.fromAsync(new Bun.Glob("**/*.{ts,tsx}").scan(cli)))
      .map((file) => file.replaceAll("\\", "/"))
      .filter((file) => !excluded.has(file))
      .sort()
    const counts = Object.fromEntries(
      (
        await Promise.all(
          files.map(async (file) => [file, [...(await Bun.file(path.join(cli, file)).text()).matchAll(runtime)].length] as const),
        )
      ).filter((entry) => entry[1] > 0),
    )

    // 数量增加：新代码或 upstream 同步带回了硬编码英文，改用 cliText() 并补字典。
    // 数量减少：有文案已被本地化，同步调低这里的基线。
    expect(counts).toEqual(runtimeEnglishBaseline)
  })

  test("Chinese copy only lives in locale dictionaries", async () => {
    const files = (await Array.fromAsync(new Bun.Glob("**/*.{ts,tsx}").scan(cli)))
      .map((file) => file.replaceAll("\\", "/"))
      .filter((file) => !excluded.has(file) && !dictionaries.has(file))
    const violations = (
      await Promise.all(
        files.map(async (file) => {
          const source = (await Bun.file(path.join(cli, file)).text())
            .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
            .replace(/(^|[^:])\/\/.*$/gm, (comment, prefix) => prefix + comment.slice(prefix.length).replace(/[^\n]/g, " "))
          return source
            .split("\n")
            .flatMap((line, index) => (line.match(/[一-鿿]/) ? [`${file}:${index + 1}: ${line.trim()}`] : []))
        }),
      )
    ).flat()

    expect(violations).toEqual([])
  })

  test("every bundled command declares Chinese and English descriptions", async () => {
    const files = await Array.fromAsync(new Bun.Glob("*.md").scan(commands))
    const violations = (
      await Promise.all(
        files.map(async (file) => {
          const frontmatter = (await Bun.file(path.join(commands, file)).text()).match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ""
          const zh = frontmatter.match(/^\s+zh:\s*"?([^"\n]*)"?\s*$/m)?.[1] ?? ""
          const en = frontmatter.match(/^\s+en:\s*"?([^"\n]*)"?\s*$/m)?.[1] ?? ""
          if (!frontmatter.match(/^description_i18n:\s*$/m)) return [`${file}: missing description_i18n`]
          if (!zh.match(/[\u4e00-\u9fff]/)) return [`${file}: description_i18n.zh is not Chinese`]
          if (!en) return [`${file}: missing description_i18n.en`]
          return []
        }),
      )
    ).flat()

    expect(files.length).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })
})
