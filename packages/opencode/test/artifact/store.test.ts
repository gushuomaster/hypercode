import { describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Effect } from "effect"
import { ArtifactStore } from "../../src/artifact/store"
import { Artifact } from "../../src/artifact/schema"
import { tmpdir } from "../fixture/fixture"

describe("artifact store", () => {
  it("stages opaque metadata and verifies owner plus integrity on read", async () => {
    await using directory = await tmpdir()
    const store = ArtifactStore.make({ root: directory.path })
    const input = {
      workflowID: "workflow-a",
      operationID: "operation-a",
      bytes: new TextEncoder().encode("image-bytes"),
      mimeType: "image/png",
    }
    const artifact = await Effect.runPromise(store.stage(input))
    const second = await Effect.runPromise(store.stage(input))
    expect(artifact.artifactID).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(second.artifactID).not.toBe(artifact.artifactID)
    expect(artifact.readRef).toBe(`artifact:${artifact.artifactID}`)
    expect(artifact.hash).toHaveLength(64)
    expect(artifact.size).toBe(input.bytes.byteLength)
    expect(JSON.stringify(artifact)).not.toContain(directory.path)
    const grant = await Effect.runPromise(store.grant({ ...input, artifactID: artifact.artifactID }))
    expect(grant.relativePath).toBe("content")
    expect(path.dirname(path.join(grant.stagingDirectory, grant.relativePath))).toBe(grant.stagingDirectory)
    expect(new TextDecoder().decode(await Effect.runPromise(store.read({ ...input, artifactID: artifact.artifactID })))).toBe(
      "image-bytes",
    )
    await expect(
      Effect.runPromise(store.read({ workflowID: "workflow-b", operationID: "operation-a", artifactID: artifact.artifactID })),
    ).rejects.toMatchObject({ code: "artifact-access-denied" })
    await Bun.write(path.join(directory.path, artifact.artifactID, "content"), "tampered")
    await expect(Effect.runPromise(store.read({ ...input, artifactID: artifact.artifactID }))).rejects.toMatchObject({
      code: "artifact-integrity-failed",
    })
  })

  it("does not accept path-shaped or guessed artifact IDs", async () => {
    await using directory = await tmpdir()
    const store = ArtifactStore.make({ root: directory.path })
    await expect(
      Effect.runPromise(store.read({
        workflowID: "workflow",
        operationID: "operation",
        artifactID: Artifact.ID.make(path.join("..", "secret")),
      })),
    ).rejects.toMatchObject({ code: "artifact-id-invalid" })
  })

  it("marks imported and expired artifacts for idempotent cleanup", async () => {
    await using directory = await tmpdir()
    const store = ArtifactStore.make({ root: directory.path, ttlMs: 10 })
    const owner = { workflowID: "workflow", operationID: "operation" }
    const imported = await Effect.runPromise(store.stage({ ...owner, bytes: new Uint8Array([1]), mimeType: "image/png" }))
    const expired = await Effect.runPromise(store.stage({
      ...owner,
      bytes: new Uint8Array([2]),
      mimeType: "image/png",
      ttlMs: 1,
    }))
    await Effect.runPromise(store.imported({ ...owner, artifactID: imported.artifactID }))
    expect(await Effect.runPromise(store.cleanup(Date.now() + 20))).toBe(2)
    expect(await Effect.runPromise(store.cleanup(Date.now() + 20))).toBe(0)
    await expect(Effect.runPromise(store.read({ ...owner, artifactID: expired.artifactID }))).rejects.toMatchObject({
      code: "artifact-not-found",
    })
  })
})
