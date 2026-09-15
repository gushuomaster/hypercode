import { expect, test } from "bun:test"
import { OpenApi } from "effect/unstable/httpapi"
import { PublicApi } from "@/server/routes/instance/httpapi/public"

test("legacy operation descriptions never expose upstream product branding", () => {
  const spec = OpenApi.fromApi(PublicApi) as {
    paths?: Record<string, Record<string, { description?: string }>>
  }
  const violations = Object.entries(spec.paths ?? {}).flatMap(([path, item]) => {
    if (path === "/api" || path.startsWith("/api/")) return []
    return Object.entries(item)
      .filter((entry): entry is [string, { description: string }] => Boolean(entry[1].description))
      .filter(([, operation]) => /opencode/i.test(operation.description))
      .map(([method, operation]) => `${method.toUpperCase()} ${path}: ${operation.description}`)
  })

  expect(violations).toEqual([])
})
