import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { getLocale } from "@opencode-ai/tui/i18n"
import * as License from "@/license/license"
import { Brand } from "@/brand"

export const LicenseCommand = cmd({
  command: "license",
  describe: "license tools",
  builder: (yargs: Argv) => {
    return yargs
      .command(MachineIDCommand)
      .command(PathCommand)
      .command(StatusCommand)
      .demandCommand()
  },
  handler: () => {},
})

const MachineIDCommand = cmd({
  command: "machine-id",
  describe: "print this machine's license ID",
  handler: async () => {
    if (!License.isSupportedPlatform()) {
      console.error(text().unsupported_platform)
      process.exitCode = 1
      return
    }
    const id = await License.machineID().catch((error: unknown) => error instanceof Error ? error : new Error(String(error)))
    if (id instanceof Error) {
      console.error([text().machine_id_error, id.message].join(EOL))
      process.exitCode = 1
      return
    }
    console.log(id)
  },
})

const PathCommand = cmd({
  command: "path",
  describe: "print the license file path",
  handler: () => {
    console.log(License.licensePath())
  },
})

const StatusCommand = cmd({
  command: "status",
  describe: "check the current license status",
  builder: (yargs: Argv) =>
    yargs.option("json", { type: "boolean", default: false, describe: "print the result as JSON" }),
  handler: async (args) => {
    const result = await License.validate()
    if (args.json) {
      // Hosts (VSCode) consume this; always exit 0 so callers can tell CLI failure from license failure.
      console.log(
        JSON.stringify({
          ok: result.status === "valid",
          status: result.status,
          path: result.path,
          expires: result.expires ?? null,
          message: result.message ?? null,
        }),
      )
      return
    }
    console.log(formatResult(result))
    if (result.status !== "valid") process.exitCode = 1
  },
})

export function shouldSkipLicenseGate(args: string[], env = process.env) {
  return (
    isBuildOrGenerateCommand(args) ||
    isTestExecutionContext(env) ||
    args.some((arg) => arg === "--help" || arg === "-h" || arg === "--version" || arg === "-v") ||
    args[0] === "help" ||
    args[0] === "completion" ||
    args[0] === "license"
  )
}

export function shouldEnforceLicenseGate(args: string[], env = process.env) {
  return !shouldSkipLicenseGate(args, env)
}

export async function enforceLicenseGate(args: string[]) {
  if (!shouldEnforceLicenseGate(args)) return
  const result = await License.validate()
  if (result.status === "valid") return

  process.stderr.write(formatResult(result) + EOL)
  process.exit(1)
}

export function formatResult(result: License.Result, locale = getLocale()) {
  const t = text(locale)
  if (result.status === "valid") {
    return [t.valid, `${t.file}${result.path}`, result.expires ? `${t.expires}${result.expires}` : t.permanent].join(EOL)
  }
  return [
    t.required,
    t[result.status],
    result.status === "unsupported_platform" ? undefined : `${t.file}${result.path}`,
    result.message,
    t.hints[result.status],
  ]
    .filter(Boolean)
    .join(EOL)
}

function text(locale = getLocale()) {
  return locale === "en" ? en : zh
}

const zh = {
  valid: `${Brand.product} 授权有效。`,
  required: `${Brand.product} 需要有效的授权才能使用。`,
  file: "授权文件：",
  expires: "有效期至（含当天）：",
  permanent: "有效期：永久",
  missing: "状态：授权文件不存在。",
  empty: "状态：授权文件为空。",
  read_error: "状态：无法读取授权文件。",
  malformed: "状态：授权文件内容格式不正确。",
  legacy_format: "状态：这是已停用的旧格式授权，当前版本不再接受。",
  bad_signature: "状态：授权签名无效（文件被修改，或不是由 HyperCode 管理员签发）。",
  machine_mismatch: "状态：授权不属于这台设备。",
  expired: "状态：授权已过期。",
  unsupported_platform: `状态：该平台不在 ${Brand.product} 交付范围内，仅支持 Windows 与 Linux。`,
  machine_id_error: "状态：无法读取本机机器码。",
  hints: {
    missing: `运行 \`${Brand.command} license machine-id\`，把输出交给管理员签发授权，再把 license.txt 放到上面的路径。`,
    empty: `把管理员签发的授权内容写入上面的文件，然后运行 \`${Brand.command} license status\` 验证。`,
    read_error: "检查文件权限后重试。",
    malformed: `确认文件里只有管理员签发的那一行授权内容，然后运行 \`${Brand.command} license status\` 验证。`,
    legacy_format: `升级后需要重新签发：运行 \`${Brand.command} license machine-id\`，把新输出交给管理员申请新授权。`,
    bad_signature: "请向管理员重新获取授权文件，不要手工修改其中内容。",
    machine_mismatch: `运行 \`${Brand.command} license machine-id\`，用本机输出向管理员申请授权。`,
    expired: "请联系管理员续期并替换授权文件。",
    unsupported_platform: undefined,
    machine_id_error: "Windows 需要能执行系统自带的 reg 命令；Linux 需要存在非空的 /etc/machine-id。",
  },
}

const en: typeof zh = {
  valid: `${Brand.product} license is valid.`,
  required: `${Brand.product} requires a valid license.`,
  file: "License file: ",
  expires: "Valid through (inclusive): ",
  permanent: "Validity: permanent",
  missing: "Status: license file not found.",
  empty: "Status: license file is empty.",
  read_error: "Status: unable to read the license file.",
  malformed: "Status: license file content is malformed.",
  legacy_format: "Status: this is a retired legacy license format and is no longer accepted.",
  bad_signature: "Status: invalid license signature (the file was modified or not issued by a HyperCode administrator).",
  machine_mismatch: "Status: this license belongs to a different machine.",
  expired: "Status: license has expired.",
  unsupported_platform: `Status: this platform is outside the ${Brand.product} delivery scope; only Windows and Linux are supported.`,
  machine_id_error: "Status: unable to read this machine's ID.",
  hints: {
    missing: `Run \`${Brand.command} license machine-id\`, send the output to your administrator, then place license.txt at the path above.`,
    empty: `Write the license issued by your administrator into the file above, then run \`${Brand.command} license status\`.`,
    read_error: "Check the file permissions and try again.",
    malformed: `Make sure the file contains only the single license line issued by your administrator, then run \`${Brand.command} license status\`.`,
    legacy_format: `Upgrades require a new license: run \`${Brand.command} license machine-id\` and send the new output to your administrator.`,
    bad_signature: "Ask your administrator for a fresh license file; do not edit its contents.",
    machine_mismatch: `Run \`${Brand.command} license machine-id\` and request a license for this machine.`,
    expired: "Contact your administrator to renew and replace the license file.",
    unsupported_platform: undefined,
    machine_id_error: "Windows requires the built-in reg command; Linux requires a non-empty /etc/machine-id.",
  },
}

function isBuildOrGenerateCommand(args: string[]) {
  return args[0] === "generate"
}

function isTestExecutionContext(env = process.env) {
  return env.NODE_ENV === "test" || Boolean(env.OPENCODE_TEST_HOME)
}
