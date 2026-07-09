const crypto = require("crypto")
const { exec } = require("child_process")
const os = require("os")
const { readFile } = require("fs/promises")
const { promisify } = require("util")

const execAsync = promisify(exec)

const HALF_MONTH = "\u534a\u4e2a\u6708"
const ONE_MONTH = "\u4e00\u4e2a\u6708"
const THREE_MONTHS = "\u4e09\u4e2a\u6708"

class LicenseGenerator {
  constructor() {
    this.secretKey = "hyper-aicode-secret-2024"
  }

  async getSystemId() {
    try {
      if (os.platform() === "win32") return await this.getWindowsSystemId()
      return await this.getLinuxSystemId()
    } catch (error) {
      console.error("\u83b7\u53d6\u7cfb\u7edf\u6807\u8bc6\u7b26\u5931\u8d25:", error)
      throw new Error("\u83b7\u53d6\u7cfb\u7edf\u6807\u8bc6\u7b26\u5931\u8d25")
    }
  }

  async getWindowsSystemId() {
    const commands = [
      "wmic cpu get processorid",
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId).Trim()"',
      'pwsh -NoProfile -Command "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId).Trim()"',
    ]

    let lastError

    for (const command of commands) {
      try {
        const stdout = await this.readCommandOutput(command)
        const processorId = this.parseWindowsSystemId(stdout)
        if (processorId) return processorId
      } catch (error) {
        lastError = error
      }
    }

    throw lastError ?? new Error("Unable to determine Windows processor id")
  }

  parseWindowsSystemId(stdout) {
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (!lines.length) return
    if (lines[0].toLowerCase() === "processorid") return lines[1]
    return lines[0]
  }

  async readCommandOutput(command) {
    const result = await execAsync(command, { windowsHide: true })
    return result.stdout.trim()
  }

  async getLinuxSystemId() {
    const machineId = (await readFile("/etc/machine-id", "utf8")).trim()
    if (machineId) return machineId
    throw new Error("Unable to determine machine-id")
  }

  generateLicense(cpuId) {
    try {
      const baseData = `${cpuId}-${this.secretKey}`
      const hash = crypto.createHash("sha256").update(baseData).digest("hex")
      const licenseCore = hash.substring(0, 32)
      const checksum = this.calculateChecksum(licenseCore)
      return this.formatLicense(licenseCore, checksum)
    } catch (error) {
      console.error("\u751f\u6210 license \u5931\u8d25:", error)
      throw error
    }
  }

  generateLicenseWithExpiry(cpuId, expiry) {
    try {
      const yyyyMMdd = this.formatDateYYYYMMDD(expiry)
      const baseData = `${cpuId}-${this.secretKey}-${yyyyMMdd}`
      const hash = crypto.createHash("sha256").update(baseData).digest("hex")
      const licenseCore = hash.substring(0, 32)
      const checksum = this.calculateChecksum(licenseCore)
      const formattedLicense = this.formatLicense(licenseCore, checksum)
      return `${formattedLicense}-${yyyyMMdd}`
    } catch (error) {
      console.error("\u751f\u6210\u5e26\u5230\u671f license \u5931\u8d25:", error)
      throw error
    }
  }

  generateTimedLicense(cpuId, durationType) {
    const days = this.getDurationDays(durationType)
    const now = new Date()
    const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    return this.generateLicenseWithExpiry(cpuId, expiry)
  }

  getDurationDays(durationType) {
    switch (durationType) {
      case HALF_MONTH:
      case "half-month":
        return 15
      case ONE_MONTH:
      case "one-month":
        return 30
      case THREE_MONTHS:
      case "three-months":
        return 90
      default:
        throw new Error(`Unsupported duration type: ${durationType}`)
    }
  }

  calculateChecksum(data) {
    let sum = 0
    for (let i = 0; i < data.length; i += 1) {
      sum += data.charCodeAt(i)
    }
    return (sum % 1000).toString().padStart(3, "0")
  }

  formatLicense(core, checksum) {
    const groups = []
    for (let i = 0; i < core.length; i += 4) {
      groups.push(core.substring(i, i + 4))
    }
    return `${groups.join("-")}-${checksum}`
  }

  validateLicense(license, cpuId) {
    try {
      const raw = license.trim()
      const basePart = raw.replace(/\|EXP=[^|]+/i, "").trim()
      const clean = basePart.replace(/-/g, "")

      if (clean.length !== 35 && clean.length !== 43) return false

      const core = clean.substring(0, 32)
      const checksum = clean.substring(32, 35)
      const expField = clean.length === 43 ? clean.substring(35, 43) : undefined

      if (checksum !== this.calculateChecksum(core)) return false

      let expiry

      if (expField) {
        if (!/^\d{8}$/.test(expField)) return false
        const yyyy = parseInt(expField.slice(0, 4), 10)
        const mm = parseInt(expField.slice(4, 6), 10)
        const dd = parseInt(expField.slice(6, 8), 10)
        expiry = new Date(`${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}T00:00:00`)
        if (Number.isNaN(expiry.getTime())) return false
      }

      if (!expField) {
        const match = raw.match(/\|EXP=(\d{4}-\d{2}-\d{2})/i)
        if (match) {
          expiry = new Date(`${match[1]}T00:00:00`)
          if (Number.isNaN(expiry.getTime())) return false
        }
      }

      const expected = expiry ? this.generateLicenseWithExpiry(cpuId, expiry) : this.generateLicense(cpuId)
      if (basePart !== expected) return false
      if (expiry && Date.now() > expiry.getTime()) return false

      return true
    } catch (error) {
      console.error("\u9a8c\u8bc1 license \u5931\u8d25:", error)
      return false
    }
  }

  formatDateYYYYMMDD(date) {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    return `${yyyy}${mm}${dd}`
  }
}

async function testLicenseGenerator() {
  const generator = new LicenseGenerator()

  console.log("=== License Generator Test ===")
  console.log(`Platform: ${os.platform()}`)

  try {
    const systemId = await generator.getSystemId()
    console.log(`System ID: ${systemId}`)

    const license = generator.generateLicense(systemId)
    console.log(`Generated license: ${license}`)
    console.log(`Validation result: ${generator.validateLicense(license, systemId) ? "valid" : "invalid"}`)

    console.log("\n=== Repeated generation check ===")
    for (let i = 0; i < 3; i += 1) {
      console.log(`License ${i + 1}: ${generator.generateLicense(systemId)}`)
    }

    console.log("\n=== Timed license samples ===")
    console.log(`${HALF_MONTH}: ${generator.generateTimedLicense(systemId, HALF_MONTH)}`)
    console.log(`${ONE_MONTH}: ${generator.generateTimedLicense(systemId, ONE_MONTH)}`)
    console.log(`${THREE_MONTHS}: ${generator.generateTimedLicense(systemId, THREE_MONTHS)}`)

    if (os.platform() !== "win32") {
      const testCpuId = "BFEBFBFF000B0671"
      console.log("\n=== Windows sample machine ===")
      console.log(`Windows CPU ID: ${testCpuId}`)
      console.log(`Generated license: ${generator.generateLicense(testCpuId)}`)
      console.log(`Validation result: ${generator.validateLicense(generator.generateLicense(testCpuId), testCpuId) ? "valid" : "invalid"}`)
    }

    return license
  } catch (error) {
    console.error("License generator test failed:", error)

    const testId = os.platform() === "win32"
      ? "BFEBFBFF000B0671"
      : "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

    console.log("\n=== Fallback sample machine ===")
    console.log(`Sample ID: ${testId}`)

    const license = generator.generateLicense(testId)
    console.log(`Generated license: ${license}`)
    console.log(`Validation result: ${generator.validateLicense(license, testId) ? "valid" : "invalid"}`)
    return license
  }
}

if (require.main === module) {
  testLicenseGenerator().catch(console.error)
}

module.exports = { LicenseGenerator, testLicenseGenerator }
