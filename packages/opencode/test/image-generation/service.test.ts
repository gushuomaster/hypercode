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

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")

const authLayer = (credentials: Record<string, string>) =>
  Layer.succeed(
    Auth.Service,
    Auth.Service.of({
      get: (provider) => Effect.succeed(credentials[provider] ? new Auth.Api({ type: "api", key: credentials[provider] }) : undefined),
      all: () => Effect.succeed({}),
      set: () => Effect.void,
      remove: () => Effect.void,
    }),
  )

async function run(
  projectDirectory: string,
  baseURL: string,
  request: ImageGeneration.Request,
  credentials: Record<string, string> = { nvidia: "stored-secret" },
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
      Effect.provide(ImageGenerationService.layer),
      Effect.provide(ImageGenerationProvider.layer({ nvidiaBaseURL: baseURL, openaiBaseURL: baseURL })),
      Effect.provide(authLayer(credentials)),
    ),
  )
}

const request = (outputDirectory: string): ImageGeneration.Request => ({
  segmentID: "seg-1",
  prompt: "test",
  referenceImages: [],
  outputDirectory,
  modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
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
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        const form = await incoming.formData()
        expect(form.getAll("image")).toHaveLength(1)
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
      expect((await fs.readdir(outputDirectory)).some((file) => file.endsWith(".tmp"))).toBe(false)
      expect(result).toMatchObject({
        segmentID: "seg-1",
        mimeType: "image/png",
        provider: "nvidia",
        model: "qwen/qwen-image-edit",
        attempts: 1,
        cost: { known: false },
      })
    } finally {
      server.stop(true)
    }
  })

  test("uses stored auth before environment credentials without exposing either secret", async () => {
    await using project = await tmpdir()
    process.env.NVIDIA_API_KEY = "environment-secret"
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
