import os from "node:os"
import path from "node:path"
import fs from "node:fs/promises"
import { createHash } from "node:crypto"
import { Effect, Context, Layer } from "effect"
import { AppProcess } from "@opencode-ai/core/process"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ChildProcess } from "effect/unstable/process"
import { Process } from "@/util/process"
import { assertSafePath, isWithinDirectory, normalizePath } from "./paths"

export type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  command?: ReadonlyArray<string>
}

export type CommandRunner = (
  command: ReadonlyArray<string>,
  options?: { cwd?: string },
) => Promise<CommandResult>

export type InitProjectInput = {
  outputDirectory: string
  productName: string
  referenceVideo: string
  productImages: ReadonlyArray<string>
  market?: string
}

export type InspectVideoInput = {
  referenceVideo: string
  outputDirectory: string
  detailWindows?: ReadonlyArray<string>
  exactWindows?: ReadonlyArray<string>
  reuseManifest?: string
  ffmpeg?: string
  ffprobe?: string
}

export type VisualAssetScript =
  | "manage_visual_assets.py"
  | "match_visual_assets.py"
  | "configure_visual_assets.py"

export type DeliveryInput = {
  segments: string
  mappings?: string
  facts?: string
  accepted?: string
  approvalOutput?: string
  promptsOutput?: string
}

export type DependencyReport = {
  missing: ReadonlyArray<"python" | "ffmpeg" | "ffprobe" | "python-packages">
  checked: ReadonlyArray<string>
}

export class SkillBridgeError extends Error {
  readonly script?: string
  readonly command?: ReadonlyArray<string>

  constructor(message: string, details?: { script?: string; command?: ReadonlyArray<string> }) {
    super(message)
    this.name = "VideoReplicaSkillBridgeError"
    this.script = details?.script
    this.command = details?.command
  }
}

export class DependencyError extends SkillBridgeError {
  readonly missing: ReadonlyArray<string>

  constructor(missing: ReadonlyArray<string>, message = `Missing workflow dependencies: ${missing.join(", ")}`) {
    super(message)
    this.name = "VideoReplicaDependencyError"
    this.missing = [...missing]
  }
}

export interface SkillBridgeLike {
  readonly source?: string
  readonly validateSkill?: () => Promise<void>
  readonly fingerprint?: () => Promise<string>
  readonly runScript?: (script: string, args: ReadonlyArray<string>, cwd?: string) => Promise<CommandResult>
  readonly checkDependencies?: (options?: { checkPythonPackages?: boolean }) => Promise<DependencyReport | void>
  readonly ensureDependencies?: (input: {
    projectDirectory: string
    confirm: (missing: DependencyReport) => Promise<boolean>
  }) => Promise<DependencyReport>
  readonly initProject?: (input: InitProjectInput) => Promise<CommandResult | void>
  readonly inspectVideo?: (input: InspectVideoInput) => Promise<Record<string, unknown> | void>
  readonly runVisualAsset?: (script: VisualAssetScript, args: ReadonlyArray<string>, cwd?: string) => Promise<CommandResult>
  readonly compileDelivery?: (input: DeliveryInput) => Promise<CommandResult | void>
}

export type CreateSkillBridgeOptions = {
  skillLocation: string
  run?: CommandRunner
  python?: string
  ffmpeg?: string
  ffprobe?: string
  platform?: string
}

const ALLOWED_SCRIPTS = new Set([
  "init_project.py",
  "inspect_video.py",
  "manage_visual_assets.py",
  "match_visual_assets.py",
  "configure_visual_assets.py",
  "delivery_compiler.py",
])

export function createSkillBridge(options: CreateSkillBridgeOptions): SkillBridgeLike {
  const platform = options.platform ?? process.platform
  const source = normalizeSkillLocation(options.skillLocation)
  const run = options.run ?? defaultRunner
  const python = options.python ?? "python"
  const ffmpeg = options.ffmpeg ?? "ffmpeg"
  const ffprobe = options.ffprobe ?? "ffprobe"
  validateExecutable(python, "Python")
  validateExecutable(ffmpeg, "FFmpeg")
  validateExecutable(ffprobe, "FFprobe")
  let activePython = python

  const scriptPath = (script: string) => {
    if (!ALLOWED_SCRIPTS.has(script) || path.basename(script) !== script)
      throw new SkillBridgeError(`Skill script is not allowed: ${script}`, { script })
    const candidate = normalizePath(path.join(source, "scripts", script))
    const scriptsRoot = normalizePath(path.join(source, "scripts"))
    if (!isWithinDirectory(scriptsRoot, candidate))
      throw new SkillBridgeError(`Skill script path escapes the skill directory: ${script}`, { script })
    return candidate
  }

  const validateSkill = async () => {
    const skill = await fs.lstat(source).catch(() => undefined)
    if (!skill?.isDirectory() || skill.isSymbolicLink()) throw new SkillBridgeError(`doubao-video-replica skill directory is unavailable: ${source}`)
    const metadata = await fs.lstat(path.join(source, "SKILL.md")).catch(() => undefined)
    if (!metadata?.isFile() || metadata.isSymbolicLink()) throw new SkillBridgeError(`doubao-video-replica skill metadata is unavailable: ${path.join(source, "SKILL.md")}`)
    const scripts = await fs.lstat(path.join(source, "scripts")).catch(() => undefined)
    if (!scripts?.isDirectory() || scripts.isSymbolicLink()) throw new SkillBridgeError(`doubao-video-replica skill scripts directory is unavailable: ${path.join(source, "scripts")}`)
    const content = await fs.readFile(path.join(source, "SKILL.md"), "utf8")
    const frontmatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
    const name = frontmatter?.[1]?.match(/^name:\s*([^\r\n#]+?)\s*$/m)?.[1]?.trim()
    if (name !== "doubao-video-replica") throw new SkillBridgeError("skill metadata name must be doubao-video-replica")
  }

  const fingerprint = async () => {
    await validateSkill()
    const hash = createHash("sha256")
    for (const file of ["SKILL.md", "requirements-visual-assets.txt", ...ALLOWED_SCRIPTS]) {
      const filePath = file.includes("/") ? path.join(source, file) : file === "SKILL.md" || file.startsWith("requirements") ? path.join(source, file) : path.join(source, "scripts", file)
      const stat = await fs.lstat(filePath).catch(() => undefined)
      if (!stat?.isFile() || stat.isSymbolicLink()) throw new SkillBridgeError(`Skill fingerprint input is unavailable: ${file}`)
      hash.update(file).update(await fs.readFile(filePath))
    }
    return hash.digest("hex")
  }

  const runScript = async (script: string, args: ReadonlyArray<string>, cwd?: string) => {
    if (platform !== "win32") throw new SkillBridgeError("VideoReplica workflow requires Windows")
    const executable = scriptPath(script)
    await validateSkill()
    const scriptStat = await fs.lstat(executable).catch(() => undefined)
    if (!scriptStat?.isFile() || scriptStat.isSymbolicLink()) throw new SkillBridgeError(`Skill script is unavailable: ${script}`, { script })
    const command = [activePython, executable, ...args]
    const result = await run(command, { cwd: cwd ?? source })
    const normalized = normalizeResult(result, command)
    if (normalized.exitCode !== 0) {
      throw new SkillBridgeError(`Skill script failed: ${script}`, { script, command })
    }
    return normalized
  }

  const probeDependencies = async (input?: { checkPythonPackages?: boolean }): Promise<DependencyReport> => {
    if (platform !== "win32") throw new DependencyError(["Windows"], "VideoReplica workflow requires Windows")
    const checks = [
      { name: "python" as const, command: [python, "--version"] },
      { name: "ffmpeg" as const, command: [ffmpeg, "-version"] },
      { name: "ffprobe" as const, command: [ffprobe, "-version"] },
    ]
    const missing: Array<"python" | "ffmpeg" | "ffprobe" | "python-packages"> = []
    for (const check of checks) {
      const result = await run(check.command).then(
        (value) => normalizeResult(value, check.command),
        () => ({ exitCode: 1, stdout: "", stderr: "", command: check.command }),
      )
      if (result.exitCode !== 0) missing.push(check.name)
    }
    if (!missing.length && input?.checkPythonPackages) {
      const packageCommand = [activePython, "-c", "import PIL, pillow_heif"]
      const packageCheck = await run(packageCommand).then(
        (value) => normalizeResult(value, packageCommand),
        () => ({ exitCode: 1, stdout: "", stderr: "", command: packageCommand }),
      )
      if (packageCheck.exitCode !== 0) missing.push("python-packages")
    }
    return { missing, checked: [...checks.map((check) => check.name), ...(input?.checkPythonPackages ? ["python-packages"] : [])] }
  }

  const checkDependencies = async (input?: { checkPythonPackages?: boolean }): Promise<DependencyReport> => {
    const report = await probeDependencies(input)
    if (report.missing.length) throw new DependencyError(report.missing)
    return report
  }

  const ensureDependencies = async (input: {
    projectDirectory: string
    confirm: (missing: DependencyReport) => Promise<boolean>
  }) => {
    const report = await probeDependencies({ checkPythonPackages: true })
    if (!report.missing.length) return report
    if (report.missing.some((item) => item !== "python-packages"))
      throw new DependencyError(report.missing, "Install Python, FFmpeg and FFprobe before continuing")
    if (!(await input.confirm(report))) throw new DependencyError(report.missing, "Python dependency installation was not approved")
    const environment = normalizePath(path.join(input.projectDirectory, ".venv"))
    await run([python, "-m", "venv", environment], { cwd: input.projectDirectory }).then((value) => {
      const result = normalizeResult(value, [python, "-m", "venv", environment])
      if (result.exitCode !== 0) throw new DependencyError(report.missing, "Could not create the isolated Python environment")
    })
    const environmentPython = path.join(environment, "Scripts", "python.exe")
    const requirements = path.join(source, "requirements-visual-assets.txt")
    const requirementsStat = await fs.stat(requirements).catch(() => undefined)
    if (!requirementsStat?.isFile()) throw new SkillBridgeError("Skill Python requirements file is unavailable")
    await run([environmentPython, "-m", "pip", "install", "-r", requirements], { cwd: input.projectDirectory }).then(
      (value) => {
        const result = normalizeResult(value, [environmentPython, "-m", "pip", "install", "-r", requirements])
        if (result.exitCode !== 0) throw new DependencyError(report.missing, "Could not install Python visual-asset dependencies")
      },
    )
    activePython = environmentPython
    const verified = await probeDependencies({ checkPythonPackages: true })
    if (verified.missing.length) throw new DependencyError(verified.missing, "Installed Python visual-asset dependencies could not be verified")
    return verified
  }

  const initProject = (input: InitProjectInput) => {
    const args = [input.outputDirectory, "--product-name", input.productName]
    if (input.market) args.push("--market", input.market)
    args.push("--reference-video", input.referenceVideo)
    for (const image of input.productImages) args.push("--product-image", image)
    return runScript("init_project.py", args, path.dirname(input.outputDirectory))
  }

  const inspectVideo = async (input: InspectVideoInput) => {
    const args = [input.referenceVideo, "--output", input.outputDirectory]
    for (const window of input.detailWindows ?? []) args.push("--detail-window", window)
    for (const window of input.exactWindows ?? []) args.push("--exact-window", window)
    if (input.reuseManifest) args.push("--reuse-manifest", input.reuseManifest)
    if (input.ffmpeg) args.push("--ffmpeg", input.ffmpeg)
    if (input.ffprobe) args.push("--ffprobe", input.ffprobe)
    const result = await runScript("inspect_video.py", args, path.dirname(input.outputDirectory))
    return parseScriptDocument(result.stdout)
  }

  const runVisualAsset = (script: VisualAssetScript, args: ReadonlyArray<string>, cwd?: string) =>
    runScript(script, args, cwd)

  const compileDelivery = (input: DeliveryInput) => {
    const args = ["--segments", input.segments]
    if (input.mappings) args.push("--mappings", input.mappings)
    if (input.facts) args.push("--facts", input.facts)
    if (input.accepted) args.push("--accepted", input.accepted)
    if (input.approvalOutput) args.push("--approval-output", input.approvalOutput)
    if (input.promptsOutput) args.push("--prompts-output", input.promptsOutput)
    return runScript("delivery_compiler.py", args, path.dirname(input.segments))
  }

  return {
    source,
    validateSkill,
    fingerprint,
    runScript,
    checkDependencies,
    ensureDependencies,
    initProject,
    inspectVideo,
    runVisualAsset,
    compileDelivery,
  }
}

export class Service extends Context.Service<Service, SkillBridgeLike>()("@opencode/VideoReplicaSkillBridge") {}

export const layer = (options?: Partial<CreateSkillBridgeOptions>) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const appProcess = yield* AppProcess.Service
      const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex")
      const source = options?.skillLocation ?? path.join(codexHome, "skills", "doubao-video-replica", "SKILL.md")
      const run: CommandRunner = async (command, input) => {
        const result = await Effect.runPromise(
          appProcess.run(
            ChildProcess.make(command[0] ?? "", command.slice(1), {
              cwd: input?.cwd,
              stdin: "ignore",
              extendEnv: true,
            }),
          ),
        )
        return {
          exitCode: result.exitCode,
          stdout: result.stdout.toString("utf8"),
          stderr: result.stderr.toString("utf8"),
          command,
        }
      }
      return Service.of(
        createSkillBridge({
          skillLocation: source,
          run,
          python: options?.python,
          ffmpeg: options?.ffmpeg,
          ffprobe: options?.ffprobe,
          platform: options?.platform,
        }),
      )
    }),
  )

export const defaultLayer = layer().pipe(Layer.provide(AppProcess.defaultLayer))

export const node = LayerNode.make(layer(), [AppProcess.node])

function normalizeSkillLocation(location: string) {
  if (!location || location.startsWith("<")) throw new SkillBridgeError("doubao-video-replica skill has no filesystem location")
  const normalized = normalizePath(location)
  return path.basename(normalized).toLowerCase() === "skill.md" ? path.dirname(normalized) : normalized
}

function validateExecutable(value: string, label: string) {
  try {
    assertSafePath(value, `${label} executable`)
  } catch (error) {
    if (error instanceof Error) throw new SkillBridgeError(error.message)
    throw new SkillBridgeError(`${label} executable is invalid`)
  }
}

function normalizeResult(value: CommandResult, command: ReadonlyArray<string>): CommandResult {
  return {
    exitCode: value.exitCode,
    stdout: typeof value.stdout === "string" ? value.stdout : String(value.stdout),
    stderr: typeof value.stderr === "string" ? value.stderr : String(value.stderr),
    command: value.command ?? command,
  }
}

function parseScriptDocument(stdout: string) {
  const text = stdout.trim()
  if (!text) return {}
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (const candidate of [text, ...lines.toReversed()]) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      continue
    }
  }
  const last = lines.at(-1)
  if (last && last.toLowerCase().endsWith(".json")) return { manifestPath: last }
  return { output: text }
}

async function defaultRunner(command: ReadonlyArray<string>, options?: { cwd?: string }): Promise<CommandResult> {
  const result = await Process.run([...command], { cwd: options?.cwd, nothrow: true })
  return {
    exitCode: result.code,
    stdout: result.stdout.toString("utf8"),
    stderr: result.stderr.toString("utf8"),
    command,
  }
}

export const allowedScripts = Object.freeze([...ALLOWED_SCRIPTS])

export * as SkillBridge from "./skill-bridge"
