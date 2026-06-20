import { createHash } from "node:crypto"

// 与 CLI 端 packages/opencode/src/license/license.ts 及签发工具 licenseGenerator.js
// 保持完全一致的算法。改动任意一处都必须三处同步。
const secretKey = "hyper-aicode-secret-2024"

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

function formatDateYYYYMMDD(value: Date) {
  return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, "0")}${String(value.getDate()).padStart(2, "0")}`
}

export function generateExpectedLicense(machineId: string, expiry?: Date) {
  const yyyymmdd = expiry ? formatDateYYYYMMDD(expiry) : ""
  const hash = createHash("sha256")
    .update(expiry ? `${machineId}-${secretKey}-${yyyymmdd}` : `${machineId}-${secretKey}`)
    .digest("hex")
  return expiry ? `${formatLicense(hash.substring(0, 32))}-${yyyymmdd}` : formatLicense(hash.substring(0, 32))
}

function validDate(value: Date) {
  if (Number.isNaN(value.getTime())) return undefined
  return value
}

function parseLocalDate(value: string) {
  return validDate(new Date(`${value}T00:00:00`))
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

export function validateLicenseKey(licenseKey: string, machineId: string, now = new Date()) {
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
  if (basePart !== generateExpectedLicense(machineId, expiry)) return { valid: false, reason: "invalid" as const }
  if (expiry && now.getTime() > expiry.getTime()) return { valid: false, reason: "expired" as const }
  return { valid: true as const }
}
