import { createHash } from "crypto"
import os from "os"
import path from "path"
import { Process } from "@/util/process"

const secretKey = "hyper-aicode-secret-2024"

export type SupportedPlatform = "win32" | "linux"

export type Validation =
  | { status: "valid"; path: string; message?: string }
  | { status: "missing" | "empty" | "read_error"; path: string; message?: string }

export function isSupportedPlatform(platform: NodeJS.Platform = process.platform): platform is SupportedPlatform {
  return platform === "win32" || platform === "linux"
}

export function licensePath(platform: NodeJS.Platform = process.platform, home = os.homedir()) {
  if (platform === "win32") return "C:\\hyper-aicode\\license.txt"
  if (platform === "linux") return path.posix.join(home.replaceAll("\\", "/"), "hyper-aicode", "license.txt")
  return path.join(home, "hyper-aicode", "license.txt")
}

export function calculateChecksum(data: string) {
  return Array.from(data)
    .reduce((sum, item) => sum + item.charCodeAt(0), 0)
    .toString()
    .padStart(3, "0")
    .slice(-3)
}

export function formatLicense(core: string, checksum = calculateChecksum(core)) {
  return `${core.match(/.{1,4}/g)?.join("-") ?? core}-${checksum}`
}

export function generateExpectedLicense(machineID: string, expiry?: Date) {
  const yyyymmdd = expiry ? formatDateYYYYMMDD(expiry) : ""
  const hash = createHash("sha256")
    .update(expiry ? `${machineID}-${secretKey}-${yyyymmdd}` : `${machineID}-${secretKey}`)
    .digest("hex")
  return expiry ? `${formatLicense(hash.substring(0, 32))}-${yyyymmdd}` : formatLicense(hash.substring(0, 32))
}

export function parseWindowsMachineID(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !/^processorid$/i.test(line))
}

export async function machineID(platform: NodeJS.Platform = process.platform) {
  if (platform === "win32") {
    const output = await Process.text(["wmic", "cpu", "get", "processorid"])
    const id = parseWindowsMachineID(output.text)
    if (id) return id
    throw new Error("Unable to get Windows CPU processor ID")
  }

  if (platform === "linux") {
    const id = (await Bun.file("/etc/machine-id").text()).trim()
    if (id) return id
    throw new Error("Unable to get Linux machine ID")
  }

  throw new Error(`Unsupported platform for HyperCode license: ${platform}`)
}

export function validateLicenseKey(licenseKey: string, machineID: string, now = new Date()) {
  const raw = licenseKey.trim()
  const suffixExpiry = parseSuffixExpiry(raw)
  const basePart = raw.replace(/\|EXP=[^|]+/i, "").trim()
  const clean = basePart.replace(/-/g, "")
  if (clean.length !== 35 && clean.length !== 43) return { valid: false, reason: "invalid" as const }

  const core = clean.substring(0, 32)
  const checksum = clean.substring(32, 35)
  const expField = clean.length === 43 ? clean.substring(35, 43) : undefined
  if (!/^[0-9a-fA-F]+$/.test(core)) return { valid: false, reason: "invalid" as const }
  if (checksum !== calculateChecksum(core)) return { valid: false, reason: "invalid" as const }

  const embeddedExpiry = expField ? parseEmbeddedExpiry(expField) : undefined
  if (expField && !embeddedExpiry) return { valid: false, reason: "invalid" as const }

  const expiry = embeddedExpiry ?? suffixExpiry
  if (basePart !== generateExpectedLicense(machineID, expiry)) return { valid: false, reason: "invalid" as const, expiry }
  if (expiry && now.getTime() > expiry.getTime()) return { valid: false, reason: "expired" as const, expiry }
  return { valid: true, expiry }
}

export async function validateFile(input?: {
  platform?: NodeJS.Platform
  home?: string
  path?: string
}): Promise<Validation> {
  const file = input?.path ?? licensePath(input?.platform ?? process.platform, input?.home)
  const license = Bun.file(file)

  if (!(await license.exists())) return { status: "missing", path: file }

  try {
    if (!(await license.text()).trim()) return { status: "empty", path: file }
    return { status: "valid", path: file }
  } catch (error) {
    return { status: "read_error", path: file, message: error instanceof Error ? error.message : String(error) }
  }
}

function parseEmbeddedExpiry(value: string) {
  if (!/^\d{8}$/.test(value)) return undefined
  return parseLocalDate(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`)
}

function parseSuffixExpiry(value: string) {
  const exp = value.match(/\|EXP=([^|]+)/i)?.[1]?.trim()
  if (!exp) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(exp)) return parseLocalDate(exp)
  if (/^\d+$/.test(exp)) return validDate(new Date(Number(exp)))
  return validDate(new Date(exp))
}

function parseLocalDate(value: string) {
  return validDate(new Date(`${value}T00:00:00`))
}

function validDate(value: Date) {
  if (Number.isNaN(value.getTime())) return undefined
  return value
}

function formatDateYYYYMMDD(value: Date) {
  return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, "0")}${String(value.getDate()).padStart(2, "0")}`
}
