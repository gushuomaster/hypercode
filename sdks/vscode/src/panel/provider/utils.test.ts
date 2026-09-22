import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { setLocale } from "../../i18n"
import { friendlyShellSubmitError } from "./shell-errors"
import { panelTitle } from "./utils"

describe("panelTitle", () => {
  test("renders session titles without the OC prefix", () => {
    assert.equal(panelTitle("New session"), "New session")
  })
})

describe("friendlyShellSubmitError", () => {
  test("maps busy UnknownError to a friendly message", () => {
    setLocale("en")
    const msg = "UnknownError: Error: Session ses_123 is busy at shell (src/session/prompt.ts:1478:25) at <anonymous> (src/server/routes/session.ts:867:41)"
    assert.equal(
      friendlyShellSubmitError(msg),
      "Session is currently running. Wait for it to finish, then retry the shell command.",
    )
  })

  test("strips prefixes and stack tails for generic errors", () => {
    setLocale("en")
    const msg = "UnknownError: Error: something bad happened (src/server/server.ts:65:1)"
    assert.equal(
      friendlyShellSubmitError(msg),
      "Failed to send shell command: something bad happened",
    )
  })

  test("localizes friendly shell errors without translating the original detail", () => {
    setLocale("zh")
    assert.equal(
      friendlyShellSubmitError("UnknownError: Error: something bad happened (src/server/server.ts:65:1)"),
      "发送 Shell 命令失败：something bad happened",
    )
  })
})
