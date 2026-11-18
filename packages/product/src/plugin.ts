// Plugin specs come from the server config: npm specs ("name@version") or resolved
// local plugins ("file:///..."). Parsing stays string-only so the VSCode webview can use it.
export type ProductPluginSpec = string | readonly [string, ...unknown[]]

export type ProductPluginEntry = {
  name: string
  version?: string
}

export function deriveProductPlugins(specs: readonly ProductPluginSpec[] | undefined): ProductPluginEntry[] {
  return (specs ?? [])
    .map((spec) => pluginEntry(typeof spec === "string" ? spec : spec[0]))
    // sort, not toSorted: the VSCode extension compiles product with a pre-ES2023 lib.
    .sort((left, right) => left.name.localeCompare(right.name))
}

function pluginEntry(value: string): ProductPluginEntry {
  if (value.startsWith("file://")) return localPluginEntry(value)
  const index = value.lastIndexOf("@")
  if (index <= 0) return { name: value, version: "latest" }
  return { name: value.substring(0, index), version: value.substring(index + 1) }
}

// Windows file URLs decode to backslash paths on the server side, so split on both separators.
function localPluginEntry(value: string) {
  const filePath = decodeURIComponent(value.replace(/^file:\/\//, ""))
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  const filename = parts.pop() || filePath
  if (!filename.includes(".")) return { name: filename }
  const basename = filename.split(".")[0]
  if (basename === "index") return { name: parts.pop() || basename }
  return { name: basename }
}
