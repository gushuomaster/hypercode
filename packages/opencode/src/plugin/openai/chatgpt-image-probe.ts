const MAX_ERROR_LENGTH = 240

export interface ChatGptImageProbeBody {
  model: string
  store: false
  stream: true
  input: [{ role: "user"; content: [{ type: "input_text"; text: string }] }]
  tools: [
    {
      type: "image_generation"
      model: "gpt-image-1"
      size: "1024x1024"
      quality: "low"
      output_format: "png"
    },
  ]
  tool_choice: { type: "image_generation" }
}

export interface ChatGptImageProbeSummary {
  topLevelKeys: string[]
  outputTypes: string[]
  imageResultLengths: number[]
  error: string | undefined
}

export function buildChatGptImageProbeBody(prompt: string, model = "gpt-5.5"): ChatGptImageProbeBody {
  return {
    model,
    store: false,
    stream: true,
    input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
    tools: [
      {
        type: "image_generation",
        model: "gpt-image-1",
        size: "1024x1024",
        quality: "low",
        output_format: "png",
      },
    ],
    tool_choice: { type: "image_generation" },
  }
}

export function summarizeChatGptImageProbeResponse(value: unknown): ChatGptImageProbeSummary {
  const record = isRecord(value) ? value : {}
  const output = Array.isArray(record.output) ? record.output : []
  const outputTypes = [typeof record.type === "string" ? record.type : undefined].flatMap((type) =>
    type ? [type] : [],
  )
  outputTypes.push(
    ...output.flatMap((item) => {
      if (!isRecord(item) || typeof item.type !== "string") return []
      return [item.type]
    }),
  )
  const nestedItem = isRecord(record.item) ? record.item : undefined
  if (nestedItem && typeof nestedItem.type === "string") outputTypes.push(nestedItem.type)
  const imageResultLengths = output.flatMap((item) => {
    if (!isRecord(item) || item.type !== "image_generation_call" || typeof item.result !== "string") return []
    return [item.result.length]
  })
  if (nestedItem?.type === "image_generation_call" && typeof nestedItem.result === "string")
    imageResultLengths.push(nestedItem.result.length)
  const errorValue = record.error ?? record.detail ?? record.message
  return {
    topLevelKeys: Object.keys(record).sort(),
    outputTypes,
    imageResultLengths,
    error:
      typeof errorValue === "string"
        ? redactProbeError(errorValue)
        : errorValue === undefined
          ? undefined
          : redactProbeError(JSON.stringify(errorValue)),
  }
}

export function summarizeChatGptImageProbeStream(value: string): ChatGptImageProbeSummary {
  const summaries = value
    .split(/\r?\n/)
    .flatMap((line) => (line.startsWith("data:") ? [line.slice(5).trim()] : []))
    .filter((line) => line && line !== "[DONE]")
    .flatMap((line) => {
      try {
        return [summarizeChatGptImageProbeResponse(JSON.parse(line) as unknown)]
      } catch {
        return []
      }
    })
  return {
    topLevelKeys: [...new Set(summaries.flatMap((summary) => summary.topLevelKeys))].sort(),
    outputTypes: summaries.flatMap((summary) => summary.outputTypes),
    imageResultLengths: summaries.flatMap((summary) => summary.imageResultLengths),
    error: summaries.find((summary) => summary.error)?.error,
  }
}

export function redactProbeError(error: string): string {
  const redacted = error
    .replace(/("?(?:access|refresh|id)_?token"?\s*:\s*")([^"\r\n]+)(")/gi, "$1[REDACTED]$3")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/("?authorization"?\s*:\s*")([^"\r\n]+)(")/gi, "$1[REDACTED]$3")
  return redacted.length > MAX_ERROR_LENGTH ? `${redacted.slice(0, MAX_ERROR_LENGTH - 1)}…` : redacted
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
