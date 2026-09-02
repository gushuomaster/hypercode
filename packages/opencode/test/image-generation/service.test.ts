import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import fs from "node:fs/promises"
import path from "node:path"
import { Auth } from "../../src/auth"
import { ImageGeneration } from "../../src/image-generation/schema"
import { ImageGenerationProvider } from "../../src/image-generation/provider"
import { ImageGenerationService } from "../../src/image-generation/service"
import { InstanceRef } from "../../src/effect/instance-ref"
import { tmpdir } from "../fixture/fixture"

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

const authLayer = (credentials: Record<string, string>) =>
  Layer.succeed(
    Auth.Service,
    Auth.Service.of({
      get: (provider) =>
        Effect.succeed(credentials[provider] ? new Auth.Api({ type: "api", key: credentials[provider] }) : undefined),
      all: () => Effect.succeed({}),
      set: () => Effect.void,
      remove: () => Effect.void,
    }),
  )

async function run(
  projectDirectory: string,
  baseURL: string,
  request: ImageGeneration.Request,
  credentials: Record<string, string> = { openai: "stored-secret" },
  options: Parameters<typeof ImageGenerationService.layer>[0] = {},
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* ImageGenerationService.Service).generate(request)
    }).pipe(
      Effect.provideService(InstanceRef, {
        directory: projectDirectory,
        worktree: projectDirectory,
        project: undefined as never,
      }),
      Effect.provide(ImageGenerationService.layer(options)),
      Effect.provide(ImageGenerationProvider.layer({ openaiBaseURL: baseURL })),
      Effect.provide(authLayer(credentials)),
    ),
  )
}

const request = (outputDirectory: string): ImageGeneration.Request => ({
  segmentID: "seg-1",
  prompt: "test",
  referenceImages: [],
  outputDirectory,
  modelPool: [{ provider: "openai", model: "gpt-image-1-mini" }],
  width: 9,
  height: 16,
})

afterEach(() => {
  delete process.env.NVIDIA_API_KEY
  delete process.env.OPENAI_API_KEY
})

describe("image generation service", () => {
  test("writes a successful response atomically and never overwrites inputs", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const reference = path.join(project.path, "reference.png")
    const referenceBytes = "reference-bytes"
    await Bun.write(reference, referenceBytes)
    let requested = ""
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        requested = incoming.url
        const form = await incoming.formData()
        expect(form.getAll("image")).toHaveLength(1)
        expect(form.get("output_format")).toBe("png")
        expect(form.has("response_format")).toBe(false)
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      const result = await run(project.path, server.url.toString(), {
        ...request(outputDirectory),
        referenceImages: [reference],
      })
      expect(result.filePath).toMatch(/seg-1.*\.png$/)
      expect(await Bun.file(result.filePath).exists()).toBe(true)
      expect(await Bun.file(reference).text()).toBe(referenceBytes)
      expect(new URL(requested).pathname).toBe("/images/edits")
      expect((await fs.readdir(outputDirectory)).some((file) => file.endsWith(".tmp"))).toBe(false)
      expect(result).toMatchObject({
        segmentID: "seg-1",
        mimeType: "image/png",
        provider: "openai",
        model: "gpt-image-1-mini",
        attempts: 1,
        cost: { known: false },
      })
    } finally {
      server.stop(true)
    }
  })

  test("uses stored auth before environment credentials without exposing either secret", async () => {
    await using project = await tmpdir()
    process.env.OPENAI_API_KEY = "environment-secret"
    const authorizations: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch: (incoming) => {
        authorizations.push(incoming.headers.get("authorization") ?? "")
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      const result = await run(project.path, server.url.toString(), request("generated"))
      expect(authorizations).toEqual(["Bearer stored-secret"])
      expect(JSON.stringify(result)).not.toContain("stored-secret")
      expect(JSON.stringify(result)).not.toContain("environment-secret")
    } finally {
      server.stop(true)
    }
  })

  test("retries one technical failure before succeeding", async () => {
    await using project = await tmpdir()
    let calls = 0
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        calls++
        if (calls === 1) return new Response("temporary", { status: 503 })
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      const result = await run(project.path, server.url.toString(), request("generated"))
      expect(calls).toBe(2)
      expect(result.attempts).toBe(2)
    } finally {
      server.stop(true)
    }
  })

  test("does not retry HTTP 409", async () => {
    await using project = await tmpdir()
    let calls = 0
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        calls++
        return new Response("conflict", { status: 409 })
      },
    })

    try {
      await expect(run(project.path, server.url.toString(), request("generated"))).rejects.toThrow("HTTP 409")
      expect(calls).toBe(1)
    } finally {
      server.stop(true)
    }
  })

  test("uses the OpenAI generations endpoint and supported JSON fields", async () => {
    await using project = await tmpdir()
    let requested = ""
    let body: Record<string, unknown> = {}
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        requested = incoming.url
        body = await incoming.json()
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      await run(project.path, server.url.toString(), request("generated"))
      expect(new URL(requested).pathname).toBe("/images/generations")
      expect(body).toMatchObject({ model: "gpt-image-1-mini", output_format: "png", size: "1024x1536" })
      expect(body).not.toHaveProperty("response_format")
    } finally {
      server.stop(true)
    }
  })

  test("does not invent an NVIDIA image endpoint when its contract is unavailable", async () => {
    await using project = await tmpdir()
    let calls = 0
    const server = Bun.serve({ port: 0, fetch: () => (calls++, new Response("unexpected")) })

    try {
      await expect(
        run(
          project.path,
          server.url.toString(),
          { ...request("generated"), modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }] },
          { nvidia: "stored-secret" },
        ),
      ).rejects.toThrow("contract unavailable")
      expect(calls).toBe(0)
    } finally {
      server.stop(true)
    }
  })

  test("counts attempts across the full model pool", async () => {
    await using project = await tmpdir()
    let calls = 0
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        calls++
        if (calls === 1) return new Response("temporary", { status: 503 })
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      const result = await run(
        project.path,
        server.url.toString(),
        {
          ...request("generated"),
          modelPool: [
            { provider: "nvidia", model: "qwen/qwen-image-edit" },
            { provider: "openai", model: "gpt-image-1-mini" },
          ],
        },
        { nvidia: "nvidia-secret", openai: "openai-secret" },
      )
      expect(result.attempts).toBe(3)
      expect(calls).toBe(2)
    } finally {
      server.stop(true)
    }
  })

  test("does not retry missing local reference images", async () => {
    await using project = await tmpdir()
    let calls = 0
    const server = Bun.serve({ port: 0, fetch: () => (calls++, new Response("unexpected")) })

    try {
      await expect(
        run(project.path, server.url.toString(), {
          ...request("generated"),
          referenceImages: [path.join(project.path, "missing.png")],
        }),
      ).rejects.toThrow("reference image")
      expect(calls).toBe(0)
    } finally {
      server.stop(true)
    }
  })

  test("freezes one reference image before the provider request", async () => {
    await using project = await tmpdir()
    const first = path.join(project.path, "first.png")
    const second = path.join(project.path, "second.png")
    await Bun.write(first, "first-bytes")
    await Bun.write(second, "second-bytes")
    const received: string[] = []
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        const form = await incoming.formData()
        for (const image of form.getAll("image")) received.push(await (image as File).text())
        await Bun.write(first, "replaced-after-read")
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      await run(project.path, server.url.toString(), { ...request("generated"), referenceImages: [first, second] })
      expect(received).toEqual(["first-bytes"])
    } finally {
      server.stop(true)
    }
  })

  test("rejects an output directory exchanged during the provider request", async () => {
    await using project = await tmpdir()
    await using outside = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        await fs.rm(outputDirectory, { recursive: true })
        await fs.symlink(outside.path, outputDirectory, process.platform === "win32" ? "junction" : "dir")
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      await expect(run(project.path, server.url.toString(), request(outputDirectory))).rejects.toThrow(
        "generated file path",
      )
      expect(await fs.readdir(outside.path)).toEqual([])
    } finally {
      server.stop(true)
    }
  })

  test("rejects invalid image magic without persisting a file", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const server = Bun.serve({
      port: 0,
      fetch: () => Response.json({ data: [{ b64_json: Buffer.from("not-an-image").toString("base64") }] }),
    })

    try {
      await expect(run(project.path, server.url.toString(), request(outputDirectory))).rejects.toThrow(
        "unsupported image format",
      )
      expect(await fs.readdir(outputDirectory)).toEqual([])
    } finally {
      server.stop(true)
    }
  })

  test("never overwrites a pre-existing destination", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    await fs.mkdir(outputDirectory)
    const destination = path.join(outputDirectory, "seg-1-fixed.png")
    await Bun.write(destination, "existing")
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ data: [{ b64_json: png.toString("base64") }] }) })

    try {
      await expect(
        run(project.path, server.url.toString(), request(outputDirectory), undefined, {
          filename: () => "seg-1-fixed.png",
        }),
      ).rejects.toThrow("already exists")
      expect(await Bun.file(destination).text()).toBe("existing")
    } finally {
      server.stop(true)
    }
  })

  test("cleans the temporary file when atomic persistence fails", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ data: [{ b64_json: png.toString("base64") }] }) })

    try {
      await expect(
        run(project.path, server.url.toString(), request(outputDirectory), undefined, {
          persist: async () => {
            throw new Error("atomic persistence failed")
          },
        }),
      ).rejects.toThrow("could not be persisted")
      expect((await fs.readdir(outputDirectory)).filter((file) => file.endsWith(".tmp"))).toEqual([])
    } finally {
      server.stop(true)
    }
  })

  test("does not follow an exchanged output directory while cleaning a temporary file", async () => {
    await using project = await tmpdir()
    await using outside = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const movedDirectory = path.join(project.path, "generated-moved")
    let outsideFile = ""
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ data: [{ b64_json: png.toString("base64") }] }) })

    try {
      await expect(
        run(project.path, server.url.toString(), request(outputDirectory), undefined, {
          persist: async (source) => {
            await fs.rename(outputDirectory, movedDirectory)
            await fs.symlink(outside.path, outputDirectory, process.platform === "win32" ? "junction" : "dir")
            outsideFile = path.join(outside.path, path.basename(source))
            await Bun.write(outsideFile, "outside-marker")
            throw new Error("atomic persistence failed")
          },
        }),
      ).rejects.toThrow("could not be persisted")
      expect(await Bun.file(outsideFile).text()).toBe("outside-marker")
    } finally {
      server.stop(true)
    }
  })

  test("rejects output directories outside the selected project", async () => {
    await using project = await tmpdir()
    await using outside = await tmpdir()
    const server = Bun.serve({
      port: 0,
      fetch: () => Response.json({ data: [{ b64_json: png.toString("base64") }] }),
    })

    try {
      await expect(run(project.path, server.url.toString(), request(outside.path))).rejects.toThrow()
    } finally {
      server.stop(true)
    }
  })
})
