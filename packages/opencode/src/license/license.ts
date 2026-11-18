import { createHash, createPublicKey, verify } from "crypto"
import os from "os"
import path from "path"
import { Option, Schema } from "effect"
import { Process } from "@/util/process"
import { publicKeys as productionKeys } from "./public-key"

export const prefix = "HCL2"

export type SupportedPlatform = "win32" | "linux"

export type PublicKey = { kid: string; spki: string }

const Day = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))

export const Payload = Schema.Struct({
  v: Schema.Literal(2),
  kid: Schema.String,
  mid: Schema.String,
  iat: Day,
  exp: Schema.optional(Day),
  sub: Schema.optional(Schema.String),
})
export type Payload = Schema.Schema.Type<typeof Payload>

const decodePayload = Schema.decodeUnknownOption(Schema.fromJsonString(Payload))

export type Status =
  | "valid"
  | "missing"
  | "empty"
  | "read_error"
  | "malformed"
  | "legacy_format"
  | "bad_signature"
  | "machine_mismatch"
  | "expired"
  | "unsupported_platform"
  | "machine_id_error"

export type Result = { status: Status; path: string; expires?: string; message?: string }

export function isSupportedPlatform(platform: NodeJS.Platform = process.platform): platform is SupportedPlatform {
  return platform === "win32" || platform === "linux"
}

export function licensePath(platform: NodeJS.Platform = process.platform, home = os.homedir()) {
  if (platform === "win32") return "C:\\hyper-aicode\\license.txt"
  if (platform === "linux") return path.posix.join(home.replaceAll("\\", "/"), "hyper-aicode", "license.txt")
  return path.join(home, "hyper-aicode", "license.txt")
}

/** Derives the printable machine fingerprint that licenses are bound to. */
export function fingerprint(platform: SupportedPlatform, raw: string) {
  const hex = createHash("sha256")
    .update(`hypercode-mid-v2:${platform}:${raw.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32)
  return hex.match(/.{4}/g)!.join("-")
}

export function normalizeMachineID(value: string) {
  const hex = value.toLowerCase().replace(/[^0-9a-f]/g, "")
  if (hex.length !== 32) return undefined
  return hex.match(/.{4}/g)!.join("-")
}

export function parseWindowsMachineGuid(stdout: string) {
  return stdout.match(/MachineGuid\s+REG_\w+\s+([0-9a-fA-F-]{36})/)?.[1]
}

export async function machineID(platform: NodeJS.Platform = process.platform) {
  if (platform === "win32") return fingerprint(platform, await windowsMachineGuid())
  if (platform === "linux") {
    const id = (await Bun.file("/etc/machine-id").text()).trim()
    if (!id) throw new Error("/etc/machine-id is empty")
    return fingerprint(platform, id)
  }
  throw new Error(`Unsupported platform: ${platform}`)
}

async function windowsMachineGuid() {
  // reg.exe ships with every Windows edition; /reg:64 avoids WOW64 redirection to a key without MachineGuid.
  const output = await Process.text(["reg", "query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid", "/reg:64"])
  const guid = parseWindowsMachineGuid(output.text)
  if (!guid) throw new Error("MachineGuid not found in HKLM\\SOFTWARE\\Microsoft\\Cryptography")
  return guid
}

/** Verifies license text against a machine fingerprint. Pure: no file or platform access. */
export function verifyLicense(
  text: string,
  input: { machineID: string; now?: Date; publicKeys?: readonly PublicKey[] },
): { status: Exclude<Status, "missing" | "empty" | "read_error" | "unsupported_platform" | "machine_id_error">; expires?: string; payload?: Payload } {
  const raw = text.trim()
  if (isLegacyLicense(raw)) return { status: "legacy_format" }

  const parts = raw.split(".")
  if (parts.length !== 3 || parts[0] !== prefix) return { status: "malformed" }
  const decoded = decodePayload(Buffer.from(parts[1], "base64url").toString("utf8"))
  if (Option.isNone(decoded)) return { status: "malformed" }
  const payload = decoded.value

  const key = (input.publicKeys ?? productionKeys).find((item) => item.kid === payload.kid)
  if (!key) return { status: "bad_signature" }
  const signature = Buffer.from(parts[2], "base64url")
  const data = Buffer.from(`${parts[0]}.${parts[1]}`, "ascii")
  const publicKey = createPublicKey({ key: Buffer.from(key.spki, "base64"), format: "der", type: "spki" })
  if (!verify(null, data, publicKey, signature)) return { status: "bad_signature" }

  if (normalizeMachineID(payload.mid) !== normalizeMachineID(input.machineID))
    return { status: "machine_mismatch", expires: payload.exp, payload }
  // exp is the last valid local day, inclusive.
  if (payload.exp && localDate(input.now ?? new Date()) > payload.exp)
    return { status: "expired", expires: payload.exp, payload }
  return { status: "valid", expires: payload.exp, payload }
}

export async function validate(input?: {
  platform?: NodeJS.Platform
  home?: string
  path?: string
  now?: Date
  publicKeys?: readonly PublicKey[]
  machineID?: () => Promise<string>
}): Promise<Result> {
  const platform = input?.platform ?? process.platform
  const file = input?.path ?? licensePath(platform, input?.home)
  if (!isSupportedPlatform(platform)) return { status: "unsupported_platform", path: file }

  const license = Bun.file(file)
  if (!(await license.exists())) return { status: "missing", path: file }
  const text = await license.text().catch((error: unknown) => error instanceof Error ? error : new Error(String(error)))
  if (text instanceof Error) return { status: "read_error", path: file, message: text.message }
  if (!text.trim()) return { status: "empty", path: file }

  const id = await (input?.machineID ?? (() => machineID(platform)))().catch((error: unknown) =>
    error instanceof Error ? error : new Error(String(error)),
  )
  if (id instanceof Error) return { status: "machine_id_error", path: file, message: id.message }

  const result = verifyLicense(text, { machineID: id, now: input?.now, publicKeys: input?.publicKeys })
  return { status: result.status, path: file, expires: result.expires }
}

function isLegacyLicense(raw: string) {
  const clean = raw.replace(/\|EXP=[^|]+/i, "").replace(/-/g, "").trim()
  return (clean.length === 35 || clean.length === 43) && /^[0-9a-fA-F]+$/.test(clean)
}

export function localDate(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
