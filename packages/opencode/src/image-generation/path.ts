import fs from "node:fs/promises"
import path from "node:path"

export async function normalizeProjectPath(projectDirectory: string, inputPath: string) {
  const project = await fs.realpath(path.resolve(projectDirectory))
  const target = path.resolve(project, inputPath)
  if (!contains(project, target)) throw new Error("Image input path must remain inside the selected project directory")

  const ancestor = await nearestExistingPath(target)
  if (!contains(project, await fs.realpath(ancestor)))
    throw new Error("Image input path must not escape through a symbolic link")
  return target
}

export const normalizeOutputPath = normalizeProjectPath

async function nearestExistingPath(target: string): Promise<string> {
  const found = await fs
    .lstat(target)
    .then(() => target)
    .catch(() => undefined)
  if (found) return found
  const parent = path.dirname(target)
  if (parent === target) throw new Error("Image output path has no existing ancestor")
  return nearestExistingPath(parent)
}

function contains(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}
