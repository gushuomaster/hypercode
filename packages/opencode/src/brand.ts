export const Brand = {
  product: "HyperCode",
  command: "hypercode",
  short: "HC",
  vscodeExtensionID: "hypercode.hypercode-vscode",
  nativePackage: "hypercode",
  binary: "hypercode",
  configFile: "opencode.json",
  configFileLabel: "opencode.json (compatibility)",
  configDir: ".opencode",
  configDirLabel: ".opencode (compatibility)",
  envPrefix: "OPENCODE",
  authPasswordEnv: "OPENCODE_SERVER_PASSWORD",
  authUsernameEnv: "OPENCODE_SERVER_USERNAME",
  mdnsDomain: "hypercode.local",
  theme: "hypercode",
  legacyTheme: "opencode",
  githubMentions: ["/hypercode", "/hc"],
  docsURL: undefined as string | undefined,
  issueURL: undefined as string | undefined,
  providerURL: undefined as string | undefined,
  goURL: undefined as string | undefined,
  releaseRepo: "your-company/hypercode",
}

const providerDisplayNames: Record<string, string> = {
  opencode: Brand.product,
  "opencode-go": `${Brand.product} Go`,
}

const modelDisplayNames: Record<string, Record<string, string>> = {
  opencode: {
    "big-pickle": `${Brand.product} Core`,
  },
}

export function brandProviderName(providerID: string, fallback?: string) {
  return providerDisplayNames[providerID] ?? fallback ?? providerID
}

export function brandModelName(providerID: string, modelID: string, fallback?: string) {
  return modelDisplayNames[providerID]?.[modelID] ?? fallback ?? modelID
}
