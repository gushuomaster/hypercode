import { describe, expect, test } from "bun:test"
import path from "node:path"

const root = path.resolve(import.meta.dir, "../..")

async function json(name: string) {
  return await Bun.file(path.join(root, name)).json() as Record<string, unknown>
}

describe("VS Code manifest localization", () => {
  test("ships matching English and Chinese package dictionaries", async () => {
    const en = await json("package.nls.json")
    const zhCn = await json("package.nls.zh-cn.json")
    const zhTw = await json("package.nls.zh-tw.json")

    expect(Object.keys(zhCn).sort()).toEqual(Object.keys(en).sort())
    expect(zhTw).toEqual(zhCn)
  })

  test("localizes manifest copy and aligns the extension version", async () => {
    const manifest = await json("package.json")
    const serialized = JSON.stringify({
      description: manifest.description,
      contributes: manifest.contributes,
    })

    expect(manifest.version).toBe("1.18.30")
    expect(serialized).not.toMatch(/[\u3400-\u9fff]/)
    expect(serialized).not.toContain("HyperCode: Refresh")
    expect(serialized).toContain("%hypercode.command.refresh%")
    expect(serialized).toContain("%hypercode.view.sessions%")
    expect(serialized).toContain("%hypercode.setting.showThinking%")
  })
})
