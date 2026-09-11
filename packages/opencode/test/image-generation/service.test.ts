import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ArtifactStore } from "../../src/artifact/store"
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
  providerOptions: Parameters<typeof ImageGenerationProvider.layer>[0] = {},
  artifactRoot?: string,
) {
  const temporary = artifactRoot ?? (await fs.mkdtemp(path.join(os.tmpdir(), "opencode-artifact-test-")))
  try {
    return await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* ImageGenerationService.Service).generate(request)
      }).pipe(
        Effect.provideService(InstanceRef, {
          directory: projectDirectory,
          worktree: projectDirectory,
          project: undefined as never,
        }),
        Effect.provide(ImageGenerationService.layer()),
        Effect.provide(ArtifactStore.layer({ root: temporary })),
        Effect.provide(
          ImageGenerationProvider.layer({ openaiBaseURL: baseURL, nvidiaBaseURL: baseURL, ...providerOptions }),
        ),
        Effect.provide(authLayer(credentials)),
      ),
    )
  } finally {
    if (!artifactRoot) await fs.rm(temporary, { recursive: true, force: true })
  }
}

const request = (): ImageGeneration.Request => ({
  workflowID: "workflow-1",
  operationID: "operation-1",
  prompt: "test",
  referenceImages: [],
  modelPool: [{ provider: "openai", model: "gpt-image-1-mini" }],
  width: 9,
  height: 16,
})

afterEach(() => {
  delete process.env.NVIDIA_API_KEY
  delete process.env.OPENAI_API_KEY
})

describe("image generation service", () => {
  test("stages a successful response outside the project without overwriting inputs", async () => {
    await using project = await tmpdir()
    await using staging = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, "reference-bytes")
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        const form = await incoming.formData()
        expect(form.getAll("image")).toHaveLength(1)
        expect(form.get("output_format")).toBe("png")
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })
    try {
      const result = await run(
        project.path,
        server.url.toString(),
        { ...request(), referenceImages: [reference] },
        undefined,
        undefined,
        staging.path,
      )
      expect(result).toMatchObject({
        operationID: "operation-1",
        provider: "openai",
        model: "gpt-image-1-mini",
        attempts: 1,
        cost: { known: false },
        artifact: { mimeType: "image/png", size: png.byteLength },
      })
      expect(JSON.stringify(result)).not.toContain(staging.path)
      expect(await Bun.file(reference).text()).toBe("reference-bytes")
      expect((await fs.readdir(project.path)).sort()).toEqual(["reference.png"])
      expect((await fs.readdir(staging.path)).some((name) => name.endsWith(".tmp"))).toBe(false)
    } finally {
      server.stop(true)
    }
  })

  test("forwards every authorized reference image to the provider", async () => {
    await using project = await tmpdir()
    const first = path.join(project.path, "first.png")
    const second = path.join(project.path, "second.png")
    await Bun.write(first, png)
    await Bun.write(second, png)
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        const form = await incoming.formData()
        expect(form.getAll("image")).toHaveLength(2)
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })
    try {
      await run(project.path, server.url.toString(), {
        ...request(),
        referenceImages: [first, second],
      })
    } finally {
      server.stop(true)
    }
  })

  test("uses stored auth before environment credentials without exposing secrets", async () => {
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
      const result = await run(project.path, server.url.toString(), request())
      expect(authorizations).toEqual(["Bearer stored-secret"])
      expect(JSON.stringify(result)).not.toContain("stored-secret")
      expect(JSON.stringify(result)).not.toContain("environment-secret")
    } finally {
      server.stop(true)
    }
  })

  test("retries one technical failure and does not retry HTTP 409", async () => {
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
      expect((await run(project.path, server.url.toString(), request())).attempts).toBe(2)
      server.reload({ fetch: () => (calls++, new Response("conflict", { status: 409 })) })
      const before = calls
      await expect(run(project.path, server.url.toString(), request())).rejects.toMatchObject({
        attempts: 1,
        failures: [{ status: 409, retryable: false }],
      })
      expect(calls - before).toBe(1)
    } finally {
      server.stop(true)
    }
  })

  test("uses the OpenAI generation contract", async () => {
    await using project = await tmpdir()
    let pathname = ""
    let body: Record<string, unknown> = {}
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        pathname = new URL(incoming.url).pathname
        body = await incoming.json()
        return Response.json({ data: [{ b64_json: png.toString("base64") }] })
      },
    })
    try {
      await run(project.path, server.url.toString(), request())
      expect(pathname).toBe("/images/generations")
      expect(body).toMatchObject({ model: "gpt-image-1-mini", output_format: "png", size: "1024x1536" })
      expect(body).not.toHaveProperty("response_format")
    } finally {
      server.stop(true)
    }
  })

  test("uses the ChatGPT OAuth image_generation Responses contract", async () => {
    await using project = await tmpdir()
    let body: Record<string, unknown> = {}
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        body = (await incoming.json()) as Record<string, unknown>
        const event = `data: ${JSON.stringify({
          type: "response.output_item.done",
          item: { type: "image_generation_call", result: png.toString("base64") },
        })}\n\ndata: [DONE]\n`
        return new Response(event, { status: 200, headers: { "content-type": "text/event-stream" } })
      },
    })
    try {
      const result = await run(
        project.path,
        server.url.toString(),
        { ...request(), modelPool: [{ provider: "openai", model: "gpt-5.5" }] },
        {
          openai: new Auth.Oauth({
            type: "oauth",
            access: "oauth-access",
            refresh: "oauth-refresh",
            expires: Date.now() + 60_000,
            accountId: "account-1",
          }),
        },
        { chatgptBaseURL: server.url.toString() },
      )
      expect(body).toMatchObject({
        model: "gpt-5.5",
        store: false,
        stream: true,
        tool_choice: { type: "image_generation" },
      })
      expect(body.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "test" }] }])
      expect(result.provider).toBe("openai")
      expect(result.artifact).toMatchObject({ mimeType: "image/png", size: png.byteLength })
    } finally {
      server.stop(true)
    }
  })

  test("uses the trusted NVIDIA Qwen image edit contract", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let body: Record<string, unknown> = {}
    const server = Bun.serve({
      port: 0,
      fetch: async (incoming) => {
        body = await incoming.json()
        return Response.json({ created: 1, data: [{ b64_json: png.toString("base64") }] })
      },
    })
    try {
      const result = await run(
        project.path,
        "http://127.0.0.1:1/v1",
        {
          ...request(),
          referenceImages: [reference],
          modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
        },
        {
          nvidia: new Auth.Api({ type: "api", key: "stored-secret", metadata: { nimBaseURL: server.url.toString() } }),
        },
      )
      expect(body).toMatchObject({
        model: "qwen/qwen-image-edit",
        prompt: "test",
        image: `data:image/png;base64,${png.toString("base64")}`,
        response_format: "b64_json",
      })
      expect(result.provider).toBe("nvidia")
    } finally {
      server.stop(true)
    }
  })

  test("rejects untrusted Qwen endpoints before credentials are sent", async () => {
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
          ...request(),
          referenceImages: [reference],
          modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
        },
        { nvidia: "stored-secret" },
        { nvidiaQwenBaseURL: "https://untrusted.example/v1", fetch: transport },
      ),
    ).rejects.toThrow("Qwen NIM endpoint is not configured")
    expect(calls).toBe(0)
  })

  test("allows an explicitly allowlisted Qwen endpoint", async () => {
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
        ...request(),
        referenceImages: [reference],
        modelPool: [{ provider: "nvidia", model: "qwen/qwen-image-edit" }],
      },
      { nvidia: "stored-secret" },
      {
        nvidiaQwenBaseURL: "https://nim.internal.test/v1",
        nvidiaAllowedHosts: ["nim.internal.test"],
        fetch: transport,
      },
    )
    expect(requested).toBe("https://nim.internal.test/v1/images/edits")
  })

  test("uses the fixed official NVIDIA FLUX endpoint", async () => {
    await using project = await tmpdir()
    const reference = path.join(project.path, "reference.png")
    await Bun.write(reference, png)
    let requested = ""
    const transport: Fetch = async (input) => {
      requested = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      return Response.json({ artifacts: [{ base64: png.toString("base64"), finishReason: "SUCCESS" }] })
    }
    await run(
      project.path,
      "http://127.0.0.1:1/v1",
      {
        ...request(),
        referenceImages: [reference],
        modelPool: [{ provider: "nvidia", model: "black-forest-labs/flux_1-kontext-dev" }],
      },
      { nvidia: "stored-secret" },
      { nvidiaBaseURL: "https://untrusted.example/v1", fetch: transport },
    )
    expect(requested).toBe("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev")
  })

  test("counts attempts across the model pool", async () => {
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
          ...request(),
          modelPool: [
            { provider: "nvidia", model: "unsupported" },
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

  test("rejects missing or external references before provider access", async () => {
    await using project = await tmpdir()
    await using outside = await tmpdir()
    let calls = 0
    const server = Bun.serve({ port: 0, fetch: () => (calls++, new Response("unexpected")) })
    try {
      await expect(
        run(project.path, server.url.toString(), {
          ...request(),
          referenceImages: [path.join(project.path, "missing.png")],
        }),
      ).rejects.toThrow("reference image")
      await expect(
        run(project.path, server.url.toString(), {
          ...request(),
          referenceImages: [path.join(outside.path, "outside.png")],
        }),
      ).rejects.toThrow("reference image")
      expect(calls).toBe(0)
    } finally {
      server.stop(true)
    }
  })

  test("rejects invalid image magic without staging output", async () => {
    await using project = await tmpdir()
    await using staging = await tmpdir()
    const server = Bun.serve({
      port: 0,
      fetch: () => Response.json({ data: [{ b64_json: Buffer.from("not-an-image").toString("base64") }] }),
    })
    try {
      await expect(
        run(project.path, server.url.toString(), request(), undefined, undefined, staging.path),
      ).rejects.toThrow("unsupported image format")
      expect(await fs.readdir(staging.path)).toEqual([])
    } finally {
      server.stop(true)
    }
  })
})
