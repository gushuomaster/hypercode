export * from "./licenseCommands"
export * from "./licensePaths"
export * from "./licenseTypes"
export * from "./licenseValidator"
export * from "./machineId"

export function licenseEnforceEnabled() {
  return process.env.HYPERCODE_LICENSE_ENFORCE === "1"
}
