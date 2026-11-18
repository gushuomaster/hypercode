#!/usr/bin/env bun
// HyperCode license issuer (internal). Usage:
//   bun script/license/issue.ts keygen [--key <path>]
//   bun script/license/issue.ts issue --mid <machine-id> [--days <n> | --exp YYYY-MM-DD] [--sub <customer>] [--key <path>] [--out <file>]
// The compiled HyperCodeLicenseGenerator.exe (see build.ts) embeds the signing key, so it needs no key file.
import fs from "fs/promises"
import os from "os"
import path from "path"
import { parseArgs } from "util"
import { createPrivateKey, createPublicKey } from "crypto"
import { localDate, verifyLicense } from "../../src/license/license"
import { generateKeyPair, keyID, signLicense } from "./sign"

// Injected by build.ts via `bun build --define`; absent when running the script directly.
declare const EMBEDDED_SIGNING_KEY: string | undefined
const embeddedKey = typeof EMBEDDED_SIGNING_KEY === "string" ? EMBEDDED_SIGNING_KEY : undefined
const defaultKey = path.join(os.homedir(), ".hypercode-license", "signing-key.pem")

// Bun's default crash report prints the surrounding bundled source, which contains the inlined signing key.
// Report every error as its message only, before anything that can throw runs.
process.on("uncaughtException", (error) => fail(`错误：${error.message}`))
process.on("unhandledRejection", (error) => fail(`错误：${error instanceof Error ? error.message : String(error)}`))

const args = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    key: { type: "string" },
    mid: { type: "string" },
    days: { type: "string" },
    exp: { type: "string" },
    sub: { type: "string" },
    out: { type: "string" },
    force: { type: "boolean", default: false },
    // Accepted so `--help` falls through to the usage message below.
    help: { type: "boolean", short: "h" },
  },
})

const command = args.positionals[0]
if (command === "keygen") await keygen()
else if (command === "issue") await issue()
else if (command === "pubkey") await pubkey()
else fail("用法：HyperCodeLicenseGenerator keygen | pubkey | issue --mid <机器码> [--days N | --exp YYYY-MM-DD] [--sub 客户] [--out 文件]")

async function keygen() {
  const file = args.values.key ?? defaultKey
  if ((await Bun.file(file).exists()) && !args.values.force) fail(`私钥已存在：${file}（如确需覆盖，加 --force）`)
  const pair = generateKeyPair()
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  await fs.writeFile(file, pair.privateKeyPem, { mode: 0o600 })
  console.log(`私钥已写入：${file}`)
  console.log("请离线备份私钥，切勿提交到 git 或放入任何交付物。")
  console.log("把以下公钥写入 packages/opencode/src/license/public-key.ts：")
  console.log(`  { kid: "${pair.kid}", spki: "${pair.spki}" },`)
}

async function pubkey() {
  const spki = publicSpki(await readKey())
  console.log(`  { kid: "${keyID(spki)}", spki: "${spki}" },`)
}

async function issue() {
  if (!args.values.mid) fail("缺少 --mid <机器码>")
  if (args.values.days && args.values.exp) fail("--days 与 --exp 只能二选一")
  const exp = args.values.exp ?? (args.values.days ? expiryFromDays(Number(args.values.days)) : undefined)
  const pem = await readKey()
  if (exp && exp < localDate(new Date())) fail(`有效期最后一天 ${exp} 早于今天`)
  const license = signLicense(pem, { kid: keyID(publicSpki(pem)), machineID: args.values.mid, exp, sub: args.values.sub })
  // Self-check against the public keys built into the product, so a wrong key never reaches a customer.
  const check = verifyLicense(license, { machineID: args.values.mid })
  if (check.status !== "valid") fail(`签发结果未通过产品内置公钥校验（${check.status}）：私钥与产品公钥不匹配，未输出 license。`)
  if (args.values.out) {
    await Bun.write(args.values.out, license + "\n")
    console.log(`License 已写入：${args.values.out}（${exp ? `有效期至 ${exp}（含当天）` : "永久"}）`)
    return
  }
  console.log(license)
}

async function readKey() {
  if (!args.values.key && embeddedKey) return embeddedKey
  const target = args.values.key ?? defaultKey
  const file = Bun.file(target)
  if (!(await file.exists())) fail(`找不到私钥：${target}（先运行 keygen，或用 --key 指定）`)
  return await file.text()
}

function publicSpki(pem: string) {
  return createPublicKey(createPrivateKey(pem)).export({ format: "der", type: "spki" }).toString("base64")
}

function expiryFromDays(days: number) {
  if (!Number.isInteger(days) || days <= 0) fail(`无效的 --days：${args.values.days}`)
  // Valid through the last day inclusive: N days counting today.
  return localDate(new Date(Date.now() + (days - 1) * 86_400_000))
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}
