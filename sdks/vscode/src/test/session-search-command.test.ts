import assert from "node:assert/strict"
import { describe, test } from "node:test"

import type { SessionInfo } from "../core/sdk"
import { buildWorkspaceSearchInputOptions, runWorkspaceSessionSearch } from "../core/commands"

function session(id: string, title: string): SessionInfo {
  return {
    id,
    directory: "/workspace",
    title,
    time: {
      created: 1,
      updated: 1,
    },
  }
}

describe("workspace session search command", () => {
  test("prefills the input box with the previous workspace query", () => {
    const options = buildWorkspaceSearchInputOptions("Workspace", "login")

    assert.equal(options.prompt, "Search sessions in Workspace")
    assert.equal(options.value, "login")
  })

  test("leaves the input box empty when there is no previous query", () => {
    const options = buildWorkspaceSearchInputOptions("Workspace")

    assert.equal(options.value, undefined)
  })

  test("does not enter search mode for an empty query", async () => {
    const calls: string[] = []

    await runWorkspaceSessionSearch({
      runtime: {
        workspaceId: "ws-1",
        dir: "/workspace",
        name: "Workspace",
        state: "ready",
        sdk: {
          session: {
            list: async () => ({ data: [] }),
          },
        },
      },
      query: "   ",
      capability: "unknown",
      capabilities: {
        set() {
          calls.push("set")
        },
      },
      sidebar: {
        setSearchLoading() {
          calls.push("loading")
        },
        setSearchResult() {
          calls.push("result")
        },
        setSearchError() {
          calls.push("error")
        },
        clearSearch() {
          calls.push("clear")
        },
      },
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
    })

    assert.deepEqual(calls, [])
  })

  test("shows an informational message when search is unsupported", async () => {
    let info = ""

    await runWorkspaceSessionSearch({
      runtime: {
        workspaceId: "ws-1",
        dir: "/workspace",
        name: "Workspace",
        state: "ready",
        sdk: {
          session: {
            list: async () => ({ data: [] }),
          },
        },
      },
      query: "login",
      capability: "unsupported",
      capabilities: {
        set() {},
      },
      sidebar: {
        setSearchLoading() {
          throw new Error("should not search")
        },
        setSearchResult() {
          throw new Error("should not search")
        },
        setSearchError() {
          throw new Error("should not search")
        },
        clearSearch() {
          throw new Error("should not search")
        },
      },
      showInformationMessage: async (message) => {
        info = message
        return undefined
      },
      showErrorMessage: async () => undefined,
    })

    assert.equal(info.includes("not supported"), true)
  })

  test("stores matching results and marks search supported after success", async () => {
    const calls: string[] = []
    let cachedState = ""

    await runWorkspaceSessionSearch({
      runtime: {
        workspaceId: "ws-1",
        dir: "/workspace",
        name: "Workspace",
        state: "ready",
        sdk: {
          session: {
            list: async () => ({ data: [session("s1", "Fix login")] }),
          },
        },
      },
      query: "login",
      capability: "unknown",
      capabilities: {
        set(_workspaceId, snapshot) {
          cachedState = snapshot.sessionSearch
        },
      },
      sidebar: {
        setSearchLoading(_workspaceId, query) {
          calls.push(`loading:${query}`)
        },
        setSearchResult(_workspaceId, query, results) {
          calls.push(`result:${query}:${results.length}`)
        },
        setSearchError() {
          calls.push("error")
        },
        clearSearch() {
          calls.push("clear")
        },
      },
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
    })

    assert.deepEqual(calls, ["loading:login", "result:login:1"])
    assert.equal(cachedState, "supported")
  })

  test("clears search and marks capability unsupported when the server rejects search", async () => {
    const calls: string[] = []
    let cachedState = ""
    let info = ""

    await runWorkspaceSessionSearch({
      runtime: {
        workspaceId: "ws-1",
        dir: "/workspace",
        name: "Workspace",
        state: "ready",
        sdk: {
          session: {
            list: async () => {
              throw new Error("501 not implemented")
            },
          },
        },
      },
      query: "login",
      capability: "unknown",
      capabilities: {
        set(_workspaceId, snapshot) {
          cachedState = snapshot.sessionSearch
        },
      },
      sidebar: {
        setSearchLoading() {
          calls.push("loading")
        },
        setSearchResult() {
          calls.push("result")
        },
        setSearchError() {
          calls.push("error")
        },
        clearSearch() {
          calls.push("clear")
        },
      },
      showInformationMessage: async (message) => {
        info = message
        return undefined
      },
      showErrorMessage: async () => undefined,
    })

    assert.deepEqual(calls, ["loading", "clear"])
    assert.equal(cachedState, "unsupported")
    assert.equal(info.includes("not supported"), true)
  })

  test("shows an error state for ambiguous search failures", async () => {
    const calls: string[] = []
    let error = ""

    await runWorkspaceSessionSearch({
      runtime: {
        workspaceId: "ws-1",
        dir: "/workspace",
        name: "Workspace",
        state: "ready",
        sdk: {
          session: {
            list: async () => {
              throw new Error("socket hang up")
            },
          },
        },
      },
      query: "login",
      capability: "unknown",
      capabilities: {
        set() {},
      },
      sidebar: {
        setSearchLoading() {
          calls.push("loading")
        },
        setSearchResult() {
          calls.push("result")
        },
        setSearchError(_workspaceId, query, message) {
          calls.push(`error:${query}:${message}`)
        },
        clearSearch() {
          calls.push("clear")
        },
      },
      showInformationMessage: async () => undefined,
      showErrorMessage: async (message) => {
        error = message
        return undefined
      },
    })

    assert.deepEqual(calls, ["loading", "error:login:socket hang up"])
    assert.equal(error.includes("socket hang up"), true)
  })
})
