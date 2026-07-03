export type LicenseCheckResult =
  | { ok: true; licensePath: string }
  | { ok: false; reason: "missing" | "empty" | "read_error" | "invalid" | "expired"; message: string; licensePath: string }

export type LicensePathsOptions = {
  platform?: NodeJS.Platform
  homedir?: () => string
}

export type MachineIdOptions = {
  platform?: NodeJS.Platform
  run?: (command: string) => Promise<string>
}

export type LicenseValidatorOptions = {
  licensePath: string
  machineId?: string
}
