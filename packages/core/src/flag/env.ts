export function names(name: string) {
  const alias = name.startsWith("OPENCODE_") ? `HYPERCODE_${name.slice("OPENCODE_".length)}` : undefined
  return alias ? [alias, name] : [name]
}
