import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export class UnsafePathError extends Error {
  readonly pathValue: string

  constructor(pathValue: string, reason: string) {
    super(`Unsafe ${pathValue ? "path" : "file path"}: ${reason}`)
    this.name = "VideoReplicaUnsafePathError"
    this.pathValue = pathValue
  }
}

export class MediaPathError extends Error {
  readonly pathValue: string

  constructor(pathValue: string, reason: string) {
    super(`Media path is invalid: ${reason}`)
    this.name = "VideoReplicaMediaPathError"
    this.pathValue = pathValue
  }
}

export type MediaKind = "video" | "image"

const videoExtensions = new Set([".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"])
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"])

export function assertSafePath(value: string, label = "path") {
  if (typeof value !== "string" || value.trim() === "") throw new UnsafePathError(value, `${label} is empty`)
  if (value.includes("\0")) throw new UnsafePathError(value, `${label} contains a null byte`)
  if (/^(?:file|https?):\/\//i.test(value)) throw new UnsafePathError(value, `${label} must be a local filesystem path`)
  const parts = value.split(/[\\/]+/)
  if (parts.some((part) => part === "..")) throw new UnsafePathError(value, `${label} contains a parent traversal`)
  return value
}

export function normalizePath(value: string, baseDirectory?: string) {
  assertSafePath(value)
  const windows = isWindowsPath(value) || (baseDirectory !== undefined && isWindowsPath(baseDirectory))
  if (windows) {
    const resolved = path.win32.isAbsolute(value)
      ? path.win32.normalize(value)
      : path.win32.resolve(baseDirectory ?? process.cwd(), value)
    return resolved
  }
  return path.resolve(baseDirectory ?? process.cwd(), value)
}

export function isWithinDirectory(rootDirectory: string, candidate: string) {
  assertSafePath(rootDirectory, "root directory")
  assertSafePath(candidate)
  const windows = isWindowsPath(rootDirectory) || isWindowsPath(candidate)
  if (windows) {
    const root = path.win32.resolve(rootDirectory).toLowerCase()
    const target = path.win32.resolve(candidate).toLowerCase()
    const relative = path.win32.relative(root, target)
    return relative === "" || (!relative.startsWith("..") && !path.win32.isAbsolute(relative))
  }
  const root = path.resolve(rootDirectory)
  const target = path.resolve(candidate)
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export function normalizeOutputPath(rootDirectory: string, candidate: string) {
  const root = normalizePath(rootDirectory)
  const target = normalizePath(candidate, root)
  if (!isWithinDirectory(root, target)) throw new UnsafePathError(candidate, "path escapes the selected output directory")
  return target
}

export const normalizeOutputDirectory = normalizeOutputPath

export async function validateMediaFile(filePath: string, kind?: MediaKind) {
  assertSafePath(filePath, "media path")
  try {
    await rejectSymlinkComponents(normalizePath(filePath))
  } catch (error) {
    if (error instanceof UnsafePathError) throw new MediaPathError(filePath, "symbolic links are not accepted")
    throw error
  }
  const stat = await fs.lstat(filePath).catch(() => undefined)
  if (!stat || !stat.isFile()) throw new MediaPathError(filePath, "file does not exist or is not a regular file")
  if (stat.isSymbolicLink()) throw new MediaPathError(filePath, "symbolic links are not accepted")
  const extension = path.extname(filePath).toLowerCase()
  if (kind === "video" && !videoExtensions.has(extension))
    throw new MediaPathError(filePath, `unsupported video extension ${extension || "(none)"}`)
  if (kind === "image" && !imageExtensions.has(extension))
    throw new MediaPathError(filePath, `unsupported image extension ${extension || "(none)"}`)
  const realPath = await fs.realpath(filePath).catch(() => undefined)
  if (!realPath) throw new MediaPathError(filePath, "file cannot be resolved")
  return realPath
}

export const validateMediaPath = validateMediaFile

export async function ensureOutputDirectory(directory: string, options: { create?: boolean } = {}) {
  assertSafePath(directory, "output directory")
  const normalized = normalizePath(directory)
  await rejectSymlinkComponents(normalized)
  const existing = await fs.lstat(normalized).catch((error: unknown) => {
    if (isNotFound(error)) return undefined
    throw error
  })
  if (!existing && options.create === false) return normalized
  if (!existing && options.create !== false) await fs.mkdir(normalized, { recursive: true })
  const stat = existing ?? (await fs.lstat(normalized))
  if (!stat.isDirectory()) throw new UnsafePathError(directory, "output path is not a directory")
  if (stat.isSymbolicLink()) throw new UnsafePathError(directory, "output directory cannot be a symbolic link")
  const realPath = await fs.realpath(normalized)
  if (realPath !== normalized && !isWithinDirectory(path.dirname(normalized), realPath))
    throw new UnsafePathError(directory, "output directory resolves outside its parent")
  return realPath
}

export function statePath(outputDirectory: string) {
  return normalizeOutputPath(outputDirectory, path.join(outputDirectory, "project-state.json"))
}

export function splitChapters(durationSeconds: number, maximumSeconds = 60) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    throw new RangeError("video duration must be a positive finite number")
  if (!Number.isFinite(maximumSeconds) || maximumSeconds <= 0 || maximumSeconds > 60)
    throw new RangeError("chapter duration must be greater than zero and no more than 60 seconds")
  const chapters: Array<{ chapter: number; startSeconds: number; endSeconds: number; durationSeconds: number }> = []
  for (let start = 0, chapter = 1; start < durationSeconds; chapter++) {
    const end = Math.min(durationSeconds, start + maximumSeconds)
    chapters.push({ chapter, startSeconds: start, endSeconds: end, durationSeconds: end - start })
    start = end
  }
  return chapters
}

export const splitIntoChapters = splitChapters

export async function atomicWriteJson(filePath: string, value: unknown) {
  assertSafePath(filePath, "state path")
  const directory = path.dirname(filePath)
  await rejectSymlinkComponents(directory)
  await fs.mkdir(directory, { recursive: true })
  await rejectSymlinkComponents(directory)
  const temporary = path.join(directory, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`)
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + os.EOL, { encoding: "utf8", flag: "wx" })
    try {
      await fs.rename(temporary, filePath)
    } catch (error) {
      if (isAlreadyExists(error)) {
        await fs.rm(filePath, { force: true })
        await fs.rename(temporary, filePath)
      } else {
        throw error
      }
    }
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined)
  }
}

async function rejectSymlinkComponents(value: string) {
  const windows = isWindowsPath(value)
  const pathApi = windows ? path.win32 : path
  const parsed = pathApi.parse(value)
  let current = parsed.root
  const components = value.slice(parsed.root.length).split(/[\\/]+/).filter(Boolean)
  for (const component of components) {
    current = pathApi.join(current, component)
    const stat = await fs.lstat(current).catch((error: unknown) => {
      if (isNotFound(error)) return undefined
      throw error
    })
    if (stat?.isSymbolicLink()) throw new UnsafePathError(value, "output directory cannot traverse a symbolic link")
  }
}

function isWindowsPath(value: string) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\")
}

function isAlreadyExists(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST"
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

export * as VideoReplicaPaths from "./paths"
