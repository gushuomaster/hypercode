import { describe, expect, test } from "bun:test"
import { SkillProtocol } from "../../src/skill-runtime/protocol"

const request = {
  protocol_version: "1.0",
  request_id: "request-1",
  command: "status",
  project_directory: process.cwd(),
  payload: {},
} satisfies SkillProtocol.Request

const response = {
  protocol_version: "1.0",
  request_id: "request-1",
  workflow_id: "workflow-1",
  revision: 1,
  status: "running",
  ready_actions: [
    {
      operation_id: "operation-1",
      type: "user.ask",
      depends_on: [],
      requirements: {},
      payload: {},
    },
  ],
  artifacts: [],
  error: null,
} satisfies SkillProtocol.Response

describe("executable skill protocol", () => {
  test("encodes a bounded request and decodes the public response envelope", () => {
    expect(JSON.parse(SkillProtocol.encodeRequest(request))).toEqual(request)
    expect(SkillProtocol.decodeResponse(JSON.stringify(response))).toEqual(response)
  })

  test("rejects logs or multiple values mixed into stdout", () => {
    expect(() => SkillProtocol.decodeResponse(`log\n${JSON.stringify(response)}`)).toThrow(
      "stdout must contain exactly one JSON object",
    )
    expect(() => SkillProtocol.decodeResponse(`${JSON.stringify(response)}\n{}`)).toThrow(
      "stdout must contain exactly one JSON object",
    )
  })

  test("rejects unsupported versions, actions, and unknown public fields", () => {
    expect(() =>
      SkillProtocol.decodeResponse(JSON.stringify({ ...response, protocol_version: "2.0" })),
    ).toThrow("major is not supported")
    expect(() =>
      SkillProtocol.decodeResponse(
        JSON.stringify({
          ...response,
          ready_actions: [{ ...response.ready_actions[0], type: "shell.run" }],
        }),
      ),
    ).toThrow("Action type is not supported")
    expect(() => SkillProtocol.decodeResponse(JSON.stringify({ ...response, private_state: {} }))).toThrow(
      "unknown fields",
    )
  })

  test("bounds requests and responses by UTF-8 byte size", () => {
    expect(() => SkillProtocol.encodeRequest({ ...request, payload: { value: "x".repeat(SkillProtocol.MAX_REQUEST_BYTES) } })).toThrow(
      "request exceeds",
    )
    expect(() => SkillProtocol.decodeResponse(" ".repeat(SkillProtocol.MAX_RESPONSE_BYTES + 1))).toThrow(
      "response exceeds",
    )
  })
})
