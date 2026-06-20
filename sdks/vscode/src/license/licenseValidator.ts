import * as fs from "node:fs/promises"
import { LicenseCheckResult, LicenseValidatorOptions } from "./licenseTypes"
import { getMachineId } from "./machineId"
import { validateLicenseKey } from "./licenseAlgorithm"

export async function validateLicense(options: LicenseValidatorOptions): Promise<LicenseCheckResult> {
  try {
    const raw = (await fs.readFile(options.licensePath, "utf8")).trim()
    if (!raw) {
      return fail("empty", "授权文件为空，请写入有效秘钥", options.licensePath)
    }

    // 默认弱校验:文件非空即通过。开启 enforce 时做机器码强校验。
    if (!options.enforce) {
      return { ok: true, licensePath: options.licensePath }
    }

    const machineId = options.machineId ?? (await getMachineId())
    const check = validateLicenseKey(raw, machineId)
    if (!check.valid) {
      const message = check.reason === "expired" ? "授权已过期" : "授权无效，与本机机器码不匹配"
      return fail(check.reason, message, options.licensePath)
    }

    return { ok: true, licensePath: options.licensePath }
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return fail("missing", "授权文件不存在", options.licensePath)
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
