import assert from "node:assert/strict"
import { test } from "node:test"
import { getLocale, setLocale } from "../../i18n"
import { remoteConfigAuthMessage } from "./remote-config-error"

test("names a remote config sign-in failure with the HyperCode re-login command", () => {
  // Locale is process-global and other test files assume the default; restore it.
  const previous = getLocale()
  setLocale("zh")
  try {
    const message = remoteConfigAuthMessage({ name: "ConfigRemoteAuthError", data: { url: "https://sso.example.test", remote: "https://config.example.test/hypercode.json" } })

    assert.match(message ?? "", /远端配置加载失败/)
    assert.match(message ?? "", /hypercode auth login https:\/\/sso\.example\.test$/)
    assert.doesNotMatch(message ?? "", /opencode/i)
  } finally {
    setLocale(previous)
  }
})

test("leaves other failures to the caller's own message", () => {
  assert.equal(remoteConfigAuthMessage({ name: "NotFoundError", data: { message: "Session not found" } }), undefined)
  assert.equal(remoteConfigAuthMessage(undefined), undefined)
})
