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
  // 默认仅做弱校验(文件非空)。开启 enforce 时做机器码强校验。
  enforce?: boolean
  machineId?: string
}
