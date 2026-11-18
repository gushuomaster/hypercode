#!/usr/bin/env bun
// Builds the internal license issuer with the signing key embedded, so the exe works on any admin machine.
// The output exe therefore IS the signing secret: keep it internal, never ship or commit it.
//   bun script/license/build.ts [--key <path>] [--target bun-windows-x64]
import os from "os"
import path from "path"
import { parseArgs } from "util"
import { createPrivateKey, createPublicKey } from "crypto"
import { publicKeys } from "../../src/license/public-key"
import { keyID } from "./sign"

const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    key: { type: "string", default: path.join(os.homedir(), ".hypercode-license", "signing-key.pem") },
    target: { type: "string", default: "bun-windows-x64" },
  },
})

const file = Bun.file(args.values.key!)
if (!(await file.exists())) fail(`找不到私钥：${args.values.key}（先运行 bun script/license/issue.ts keygen，或用 --key 指定）`)
const pem = await file.text()
const spki = createPublicKey(createPrivateKey(pem)).export({ format: "der", type: "spki" }).toString("base64")
const kid = keyID(spki)
// Refuse to build an issuer whose licenses the product would reject.
if (!publicKeys.some((item) => item.kid === kid && item.spki === spki))
  fail(`私钥（kid ${kid}）对应的公钥不在 src/license/public-key.ts 中，产品不会接受它签发的 license。`)

const outfile = path.join(import.meta.dir, "dist", args.values.target!.includes("windows") ? "HyperCodeLicenseGenerator.exe" : "HyperCodeLicenseGenerator")
const proc = Bun.spawnSync(
  [
    process.execPath,
    "build",
    "--compile",
    `--target=${args.values.target}`,
    "--define",
    `EMBEDDED_SIGNING_KEY=${JSON.stringify(pem)}`,
    path.join(import.meta.dir, "issue.ts"),
    "--outfile",
    outfile,
  ],
  { stdout: "inherit", stderr: "inherit" },
)
if (proc.exitCode !== 0) fail("构建失败。")

console.log(`构建完成：${outfile}（已内置 kid ${kid} 的私钥）`)
console.log("注意：这个 exe 本身就能签发 license，只能内部保管，不要发给客户、不要提交到 git。")

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
