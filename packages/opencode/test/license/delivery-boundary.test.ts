import { describe, expect, test } from "bun:test"
import path from "path"

const repo = path.resolve(import.meta.dir, "../../../..")
// Built from fragments so this guard does not match itself.
const legacySecret = ["hyper", "aicode", "secret", "2024"].join("-")
const privateKeyHeader = ["-----BEGIN", "PRIVATE KEY-----"].join(" ")

// Product sources that end up in hypercode.exe or hypercode.vsix.
const shipped = ["packages/opencode/src", "packages/tui/src", "packages/product/src", "packages/core/src", "sdks/vscode/src"]

describe("license delivery boundary", () => {
  test("shipped sources contain no signing secret and never import the issuer", async () => {
    const offenders = (
      await Promise.all(
        shipped.map(async (dir) =>
          Promise.all(
            Array.from(new Bun.Glob("**/*.{ts,tsx,js,cjs,mjs,json}").scanSync({ cwd: path.join(repo, dir) })).map(
              async (file) => {
                const text = await Bun.file(path.join(repo, dir, file)).text()
                const found = [
                  text.includes(legacySecret) && "legacy secret",
                  text.includes(privateKeyHeader) && "private key",
                  /script\/license/.test(text) && "issuer import",
                ].filter(Boolean)
                return found.length ? `${dir}/${file}: ${found.join(", ")}` : undefined
              },
            ),
          ),
        ),
      )
    )
      .flat()
      .filter(Boolean)
    expect(offenders).toEqual([])
  })

  test("git tracks no private key files or key-embedding issuer builds", async () => {
    const tracked = Bun.spawnSync(["git", "ls-files", "*.pem", "*.key", "*HyperCodeLicenseGenerator*"], { cwd: repo })
      .stdout.toString()
      .trim()
    expect(tracked).toBe("")
  })
})
