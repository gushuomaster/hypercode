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

type Fetch = (
  input: Parameters<typeof globalThis.fetch>[0],
  init?: Parameters<typeof globalThis.fetch>[1],
) => ReturnType<typeof globalThis.fetch>

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

const authLayer = (credentials: Record<string, string | Auth.Info>) =>
  Layer.succeed(
    Auth.Service,
    Auth.Service.of({
      get: (provider) =>
        Effect.succeed(
          typeof credentials[provider] === "string"
            ? new Auth.Api({ type: "api", key: credentials[provider] })
            : credentials[provider],
        ),
      all: () => Effect.succeed({}),
      set: () => Effect.void,
      remove: () => Effect.void,
    }),
  )

async function run(
  projectDirectory: string,
  baseURL: string,
  request: ImageGeneration.Request,
  credentials: Record<string, string | Auth.Info> = { openai: "stored-secret" },
  options: Parameters<typeof ImageGenerationService.layer>[0] = {},
  providerOptions: Parameters<typeof ImageGenerationProvider.layer>[0] = {},
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
      Effect.provide(
        ImageGenerationProvider.layer({ openaiBaseURL: baseURL, nvidiaBaseURL: baseURL, ...providerOptions }),
      ),
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

  test("uses the NVIDIA Qwen OpenAI-compatible image edit contract", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let requested = ""
    let authorization = ""
    let body: Record<string, unknown> = {}
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        requested = incoming.url
        authorization = incoming.headers.get("authorization") ?? ""
        body = await incoming.json()
        return Response.json({ created: 1, data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      const result = await run(
        project.path,
        server.url.toString(),
        {
          ...request("generated"),
          referenceImages: [reference],
          modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
        },
        {
          nvidia: new Auth.Api({
            type: "api",
            key: "stored-secret",
            metadata: { nimBaseURL: server.url.toString() },
          }),
        },
      )
      expect(new URL(requested).pathname).toBe("/v1/images/edits")
      expect(authorization).toBe("Bearer stored-secret")
      expect(body).toEqual({
        model: "qwen/qwen-image-edit",
        prompt: "test",
        image: `data:image/png;base64,${png.toString("base64")}`,
        n: 1,
        response_format: "b64_json",
        size: "864x1536",
      })
      expect(result).toMatchObject({ provider: "nvidia", model: "qwen/qwen-image-edit", mimeType: "image/png" })
    } finally {
      server.stop(true)
    }
  })

  test("rejects an arbitrary HTTPS Qwen NIM endpoint before sending the NVIDIA key", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let calls = 0
    const transport: Fetch = async () => {
      calls++
      return Response.json({ created: 1, data: [{ b64_json: png.toString("base64") }] })
    }

    await expect(
      run(
        project.path,
        "http://127.0.0.1:1/v1",
        {
          ...request("generated"),
          referenceImages: [reference],
          modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
        },
        { nvidia: "stored-secret" },
        {},
        { nvidiaQwenBaseURL: "https://untrusted.example/v1", fetch: transport },
      ),
    ).rejects.toThrow("Qwen NIM endpoint is not configured")
    expect(calls).toBe(0)
  })

  test("allows a Qwen NIM host only when it is explicitly allowlisted", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let requested = ""
    const transport: Fetch = async (input) => {
      requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      return Response.json({ created: 1, data: [{ b64_json: png.toString("base64") }] })
    }

    const result = await run(
      project.path,
      "http://127.0.0.1:1/v1",
      {
        ...request("generated"),
        referenceImages: [reference],
        modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
      },
      { nvidia: new Auth.Api({ type: "api", key: "stored-secret", metadata: { nimBaseURL: "https://nim.internal.test/v1" } }) },
      {},
      { nvidiaAllowedHosts: ["nim.internal.test"], fetch: transport },
    )

    expect(new URL(requested).origin).toBe("https://nim.internal.test")
    expect(result.model).toBe("qwen/qwen-image-edit")
  })

  test("allows the IPv6 loopback Qwen NIM endpoint", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let requested = ""
    const transport: Fetch = async (input) => {
      requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      return Response.json({ created: 1, data: [{ b64_json: png.toString("base64") }] })
    }

    await run(
      project.path,
      "http://127.0.0.1:1/v1",
      {
        ...request("generated"),
        referenceImages: [reference],
        modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
      },
      { nvidia: "stored-secret" },
      {},
      { nvidiaQwenBaseURL: "http://[::1]:8000/v1", fetch: transport },
    )

    expect(requested).toBe("http://[::1]:8000/v1/images/edits")
  })

  test("uses the fixed official NVIDIA host for hosted FLUX", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let requested = ""
    const transport: Fetch = async (input) => {
      requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      return Response.json({ artifacts: [{ base64: png.toString("base64"), finishReason: "SUCCESS", seed: 1 }] })
    }

    await run(
      project.path,
      "http://127.0.0.1:1/v1",
      {
        ...request("generated"),
        referenceImages: [reference],
        modelPool: [{ provider: "nvidia", model: "black-forest-labs/flux_1-kontext-dev" }],
      },
      { nvidia: "stored-secret" },
      {},
      { nvidiaBaseURL: "https://untrusted.example/v1", fetch: transport },
    )
    expect(requested).toBe("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev")
  })

  test("maps the dotted NVIDIA FLUX slug to the same official endpoint", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let requested = ""
    const transport: Fetch = async (input) => {
      requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      return Response.json({ artifacts: [{ base64: png.toString("base64"), finishReason: "SUCCESS", seed: 1 }] })
    }

    const result = await run(
      project.path,
      "http://127.0.0.1:1/v1",
      {
        ...request("generated"),
        referenceImages: [reference],
        modelPool: [{ provider: "nvidia", model: "black-forest-labs/flux.1-kontext-dev" }],
      },
      { nvidia: "stored-secret" },
      {},
      { nvidiaBaseURL: "https://untrusted.example/v1", fetch: transport },
    )
    expect(requested).toBe("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev")
    expect(result.model).toBe("black-forest-labs/flux.1-kontext-dev")
  })

  test("rejects a Qwen response missing the required created timestamp", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    const server = Bun.serve({
      port: 0,
      fetch: () => Response.json({ data: [{ b64_json: png.toString("base64") }] }),
    })

    try {
      await expect(
        run(
          project.path,
          "http://127.0.0.1:1/v1",
          {
            ...request("generated"),
            referenceImages: [reference],
            modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
          },
          { nvidia: new Auth.Api({ type: "api", key: "stored-secret", metadata: { nimBaseURL: server.url.toString() } }) },
        ),
      ).rejects.toThrow("created")
    } finally {
      server.stop(true)
    }
  })

  test("uses the NVIDIA FLUX hosted model endpoint and native request contract", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let requested = ""
    let body: Record<string, unknown> = {}
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        requested = incoming.url
        body = await incoming.json()
        return Response.json({
          artifacts: [{ base64: png.toString("base64"), finishReason: "SUCCESS", seed: 1 }],
        })
      },
    })

    try {
      const result = await run(
        project.path,
        server.url.toString(),
        {
          ...request("generated"),
          referenceImages: [reference],
          modelPool: [{ provider: "nvidia", model: "black-forest-labs/flux_1-kontext-dev" }],
        },
        { nvidia: "stored-secret" },
        {},
        {
          fetch: async (input, init) => {
            requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
            return globalThis.fetch(new URL("/v1/genai/black-forest-labs/flux.1-kontext-dev", server.url), init)
          },
        },
      )
      expect(new URL(requested).pathname).toBe("/v1/genai/black-forest-labs/flux.1-kontext-dev")
      expect(body).toEqual({
        prompt: "test",
        image: `data:image/png;base64,${png.toString("base64")}`,
        aspect_ratio: "match_input_image",
        steps: 30,
        cfg_scale: 3.5,
        seed: 0,
      })
      expect(result).toMatchObject({
        provider: "nvidia",
        model: "black-forest-labs/flux_1-kontext-dev",
        mimeType: "image/png",
      })
    } finally {
      server.stop(true)
    }
  })

  test("fails Qwen safely before HTTP when no trusted NIM endpoint is configured", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let calls = 0
    const server = Bun.serve({ port: 0, fetch: () => (calls++, new Response("unexpected")) })

    try {
      await expect(
        run(
          project.path,
          server.url.toString(),
          {
            ...request("generated"),
            referenceImages: [reference],
            modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
          },
          { nvidia: "stored-secret" },
          {},
          { nvidiaBaseURL: undefined },
        ),
      ).rejects.toThrow("Qwen NIM endpoint is not configured")
      expect(calls).toBe(0)
    } finally {
      server.stop(true)
    }
  })

  test("rejects an untrusted remote Qwen NIM endpoint before HTTP", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let calls = 0
    const server = Bun.serve({ port: 0, fetch: () => (calls++, new Response("unexpected")) })

    try {
      await expect(
        run(
          project.path,
          server.url.toString(),
          {
            ...request("generated"),
            referenceImages: [reference],
            modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
          },
          { nvidia: "stored-secret" },
          {},
          { nvidiaQwenBaseURL: "http://example.com" },
        ),
      ).rejects.toThrow("Qwen NIM endpoint is not configured")
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

  test("does not expose the destination before provider output is ready", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const destination = path.join(outputDirectory, "seg-1-fixed.png")
    let destinationExists = false
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        destinationExists = await Bun.file(destination).exists()
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      await run(project.path, server.url.toString(), request(outputDirectory), undefined, {
        stem: () => "seg-1-fixed",
      })
      expect(destinationExists).toBe(false)
      expect(await Bun.file(destination).exists()).toBe(true)
    } finally {
      server.stop(true)
    }
  })

  test("does not overwrite a destination created during provider execution", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const destination = path.join(outputDirectory, "seg-1-fixed.png")
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        await Bun.write(destination, "replacement-marker")
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      await expect(
        run(project.path, server.url.toString(), request(outputDirectory), undefined, {
          stem: () => "seg-1-fixed",
        }),
      ).rejects.toThrow("could not be persisted")
      expect(await Bun.file(destination).text()).toBe("replacement-marker")
    } finally {
      server.stop(true)
    }
  })

  test("rejects an output directory exchanged during the provider request", async () => {
    await using project = await tmpdir()
    await using outside = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const movedDirectory = path.join(project.path, "generated-moved")
    const destination = path.join(outputDirectory, "seg-1-fixed.png")
    const outsideFile = path.join(outside.path, "seg-1-fixed.png")
    let reservedBeforeRequest = false
    let exchangeBlocked = false
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        reservedBeforeRequest = await fs
          .stat(destination)
          .then(() => false)
          .catch((error) => error.code === "ENOENT")
        if (!reservedBeforeRequest) return Response.json({ data: [{ b64_json: png.toString("base64") }] })
        const exchanged = await fs
          .rename(outputDirectory, movedDirectory)
          .then(() => true)
          .catch((error) => {
            if (process.platform !== "win32" || error.code !== "EPERM") throw error
            exchangeBlocked = true
            return false
          })
        if (!exchanged) return Response.json({ data: [{ b64_json: png.toString("base64") }] })
        await fs.symlink(outside.path, outputDirectory, process.platform === "win32" ? "junction" : "dir")
        await Bun.write(outsideFile, "outside-marker")
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      const outcome = await run(project.path, server.url.toString(), request(outputDirectory), undefined, {
        stem: () => "seg-1-fixed",
      }).then(
        (value) => ({ value }),
        (error) => ({ error }),
      )
      expect(reservedBeforeRequest).toBe(true)
      if (process.platform === "win32") {
        expect(exchangeBlocked).toBe(true)
        expect(outcome).toHaveProperty("value")
        expect(await Bun.file(destination).exists()).toBe(true)
        return
      }
      expect(outcome).toHaveProperty("error")
      if ("error" in outcome) expect(String(outcome.error)).toContain("could not be persisted")
      expect(await Bun.file(outsideFile).text()).toBe("outside-marker")
      expect(await Bun.file(path.join(movedDirectory, "seg-1-fixed.png")).exists()).toBe(false)
    } finally {
      server.stop(true)
    }
  })

  test("does not write or remove a destination exchanged during the provider request", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const destination = path.join(outputDirectory, "seg-1-fixed.png")
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        await Bun.write(destination, "replacement-marker")
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })

    try {
      const outcome = await run(project.path, server.url.toString(), request(outputDirectory), undefined, {
        stem: () => "seg-1-fixed",
      }).then(
        (value) => ({ value }),
        (error) => ({ error }),
      )
      expect(outcome).toHaveProperty("error")
      if ("error" in outcome) expect(String(outcome.error)).toContain("could not be persisted")
      expect(await Bun.file(destination).text()).toBe("replacement-marker")
    } finally {
      server.stop(true)
    }
  })

  test("rejects invalid image magic without persisting a file", async () => {
    await using project = await tmpdir()
    const outputDirectory = path.join(project.path, "generated")
    const destination = path.join(outputDirectory, "seg-1-fixed.png")
    let reservedBeforeRequest = false
    const server = Bun.serve({
      port: 0,
      fetch: async () => {
        reservedBeforeRequest = await fs
          .stat(destination)
          .then(() => false)
          .catch((error) => error.code === "ENOENT")
        return Response.json({ data: [{ b64_json: Buffer.from("not-an-image").toString("base64") }] })
      },
    })

    try {
      await expect(
        run(project.path, server.url.toString(), request(outputDirectory), undefined, {
          stem: () => "seg-1-fixed",
        }),
      ).rejects.toThrow("unsupported image format")
      expect(reservedBeforeRequest).toBe(true)
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
    let calls = 0
    server.reload({ fetch: () => (calls++, Response.json({ data: [{ b64_json: png.toString("base64") }] })) })

    try {
      await expect(
        run(project.path, server.url.toString(), request(outputDirectory), undefined, {
          stem: () => "seg-1-fixed",
        }),
      ).rejects.toThrow("already exists")
      expect(calls).toBe(0)
      expect(await Bun.file(destination).text()).toBe("existing")
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
