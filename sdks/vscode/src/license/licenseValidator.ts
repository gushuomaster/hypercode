import * as fs from "node:fs/promises"
import { LicenseCheckResult, LicenseValidatorOptions } from "./licenseTypes"
import { getMachineId } from "./machineId"
import { validateLicenseKey } from "./licenseAlgorithm"

export async function validateLicense(options: LicenseValidatorOptions): Promise<LicenseCheckResult> {
  try {
    const raw = (await fs.readFile(options.licensePath, "utf8")).trim()
    if (!raw) {
      return fail("empty", "License file is empty. Write a valid key to continue.", options.licensePath)
    }

    const machineId = options.machineId ?? (await getMachineId())
    const check = validateLicenseKey(raw, machineId)
    if (!check.valid) {
      const message = check.reason === "expired" ? "License has expired." : "License is invalid for this machine."
      return fail(check.reason, message, options.licensePath)
    }

    return { ok: true, licensePath: options.licensePath }
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return fail("missing", "License file does not exist.", options.licensePath)
    }
    return fail("read_error", error instanceof Error ? error.message : String(error), options.licensePath)
  }
}

function fail(
  reason: "missing" | "empty" | "read_error" | "invalid" | "expired",
  message: string,
  licensePath: string,
): LicenseCheckResult {
  return { ok: false, reason, message, licensePath }
}
