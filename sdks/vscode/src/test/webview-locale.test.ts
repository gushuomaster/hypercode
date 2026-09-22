import { afterEach, describe, expect, test } from "bun:test"
import type * as vscode from "vscode"
import { setLocale } from "../i18n"
import { sessionPanelHtml } from "../panel/html"
import { sidebarViewHtml } from "../sidebar/html"

const webview = {
  cspSource: "vscode-webview:",
  asWebviewUri(value: vscode.Uri) {
    return value
  },
} as vscode.Webview

const extensionUri = { path: "/extension", fsPath: "/extension" } as vscode.Uri

afterEach(() => setLocale("en"))

describe("webview locale bootstrap", () => {
  test("writes the active locale into panel HTML", () => {
    setLocale("zh-CN")
    expect(sessionPanelHtml(webview, extensionUri)).toContain('<html lang="zh">')
  })

  test("localizes sidebar HTML titles", () => {
    setLocale("zh-TW")
    expect(sidebarViewHtml(webview, extensionUri, "todo")).toContain("<title>待办事项</title>")
    expect(sidebarViewHtml(webview, extensionUri, "subagents")).toContain("<title>子智能体</title>")

    setLocale("en-US")
    expect(sidebarViewHtml(webview, extensionUri, "diff")).toContain("<title>Modified Files</title>")
  })
})
