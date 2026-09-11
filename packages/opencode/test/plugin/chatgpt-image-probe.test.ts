import { describe, expect, test } from "bun:test"
import {
  buildChatGptImageProbeBody,
  summarizeChatGptImageProbeResponse,
  summarizeChatGptImageProbeStream,
  redactProbeError,
} from "../../src/plugin/openai/chatgpt-image-probe"

describe("ChatGPT image probe", () => {
  test("builds a low-quality image_generation request without secrets", () => {
    const body = buildChatGptImageProbeBody("画一只猫")
    expect(body).toEqual({
      model: "gpt-5.5",
      store: false,
      stream: true,
      input: [{ role: "user", content: [{ type: "input_text", text: "画一只猫" }] }],
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
    })
    expect(JSON.stringify(body)).not.toContain("authorization")
  })

  test("allows probing a specific Codex model", () => {
    expect(buildChatGptImageProbeBody("测试", "gpt-5.2").model).toBe("gpt-5.2")
  })

  test("summarizes an image_generation_call without exposing image data", () => {
    const summary = summarizeChatGptImageProbeResponse({
      id: "resp_123",
      output: [{ type: "image_generation_call", id: "call_1", result: "a".repeat(128) }],
    })
    expect(summary).toEqual({
      topLevelKeys: ["id", "output"],
      outputTypes: ["image_generation_call"],
      imageResultLengths: [128],
      error: undefined,
    })
    expect(JSON.stringify(summary)).not.toContain("aaa")
  })

  test("includes provider detail in the redacted error summary", () => {
    const summary = summarizeChatGptImageProbeResponse({ detail: "image_generation is not supported" })
    expect(summary.error).toBe("image_generation is not supported")
  })

  test("summarizes image calls from a streamed SSE response", () => {
    const summary = summarizeChatGptImageProbeStream(
      'data: {"type":"response.output_item.done","item":{"type":"image_generation_call","result":"abc"}}\n\ndata: [DONE]\n',
    )
    expect(summary.outputTypes).toEqual(["response.output_item.done", "image_generation_call"])
    expect(summary.imageResultLengths).toEqual([3])
  })

  test("redacts and truncates provider errors", () => {
    const error = redactProbeError(
      JSON.stringify({ error: "invalid token", access_token: "secret", refresh_token: "refresh" }) + "x".repeat(300),
    )
    expect(error).toContain("invalid token")
    expect(error).not.toContain("secret")
    expect(error).not.toContain('"refresh"')
    expect(error.length).toBeLessThanOrEqual(240)
  })
})
