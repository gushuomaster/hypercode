export type Provider = "nvidia" | "openai"

export type Request = {
  segmentID: string
  prompt: string
  referenceImages: ReadonlyArray<string>
  outputDirectory: string
  modelPool: ReadonlyArray<{ provider: Provider; model: string }>
  width: 9
  height: 16
}

export type Result = {
  segmentID: string
  filePath: string
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  provider: Provider
  model: string
  attempts: number
  elapsedMs: number
  cost: { amount?: number; currency?: string; known: boolean }
}

export * as ImageGeneration from "./schema"
