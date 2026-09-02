import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "../fixture/fixture"
import { normalizeOutputPath } from "../../src/image-generation/path"

describe("image generation output paths", () => {
  test("rejects output paths outside the selected project directory", async () => {
    await expect(normalizeOutputPath("C:\\work\\project", "..\\escape.png")).rejects.toThrow()
  })

  test("rejects switching Windows drives", async () => {
    await expect(normalizeOutputPath("C:\\work\\project", "D:\\escape.png")).rejects.toThrow()
  })

  test("accepts a nested path within the selected project directory", async () => {
    await using project = await tmpdir()
    expect(await normalizeOutputPath(project.path, path.join("images", "result.png"))).toBe(
      path.join(project.path, "images", "result.png"),
    )
  })

  test("rejects a path whose existing ancestor is a symlink outside the project", async () => {
    await using project = await tmpdir()
    await using outside = await tmpdir()
    const link = path.join(project.path, "linked")
    await fs.symlink(outside.path, link, process.platform === "win32" ? "junction" : "dir")

    await expect(normalizeOutputPath(project.path, path.join("linked", "escape.png"))).rejects.toThrow()
  })
})
