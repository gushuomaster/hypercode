export interface BuildTarget {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}

export const allBuildTargets: BuildTarget[] = [
  {
    os: "linux",
    arch: "arm64",
  },
  {
    os: "linux",
    arch: "x64",
  },
  {
    os: "linux",
    arch: "x64",
    avx2: false,
  },
  {
    os: "linux",
    arch: "arm64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
    avx2: false,
  },
  {
    os: "darwin",
    arch: "arm64",
  },
  {
    os: "darwin",
    arch: "x64",
  },
  {
    os: "darwin",
    arch: "x64",
    avx2: false,
  },
  {
    os: "win32",
    arch: "arm64",
  },
  {
    os: "win32",
    arch: "x64",
  },
  {
    os: "win32",
    arch: "x64",
    avx2: false,
  },
]

export function buildTargetName(target: BuildTarget) {
  return [
    target.os === "win32" ? "windows" : target.os,
    target.arch,
    target.avx2 === false ? "baseline" : undefined,
    target.abi === undefined ? undefined : target.abi,
  ]
    .filter(Boolean)
    .join("-")
}

export function resolveBuildTargets(input: {
  targets?: string[]
  single: boolean
  baseline: boolean
  platform: NodeJS.Platform
  arch: string
}) {
  if (input.targets?.length && input.single) throw new Error("--target cannot be combined with --single")
  if (input.targets?.length && input.baseline) throw new Error("--target cannot be combined with --baseline")

  if (input.targets?.length) {
    return [...new Set(input.targets)].map((name) => {
      const target = allBuildTargets.find((item) => buildTargetName(item) === name)
      if (target) return target
      throw new Error(
        `Unsupported build target: ${name}. Available targets: ${allBuildTargets.map(buildTargetName).join(", ")}`,
      )
    })
  }

  if (!input.single) return allBuildTargets

  return allBuildTargets.filter((item) => {
    if (item.os !== input.platform || item.arch !== input.arch) return false
    if (item.avx2 === false) return input.baseline
    if (item.abi !== undefined) return false
    return true
  })
}
