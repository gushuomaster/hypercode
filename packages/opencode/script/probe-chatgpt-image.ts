import os from "node:os"
import path from "node:path"
import {
  buildChatGptImageProbeBody,
  redactProbeError,
  summarizeChatGptImageProbeResponse,
  summarizeChatGptImageProbeStream,
} from "../src/plugin/openai/chatgpt-image-probe"

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
const DEFAULT_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses"
const DEFAULT_AUTH_FILE = path.join(os.homedir(), ".local", "share", "opencode", "auth.json")

interface AuthEntry {
  type?: string
  access?: string
  refresh?: string
  expires?: number
  accountId?: string
}

function argument(name: string, fallback: string): string {
  const index = Bun.argv.indexOf(name)
  return index >= 0 && Bun.argv[index + 1] ? Bun.argv[index + 1] : fallback
}

async function readAuth(file: string): Promise<AuthEntry> {
  const value: unknown = await Bun.file(file).json()
  if (typeof value !== "object" || value === null || typeof (value as Record<string, unknown>).openai !== "object") {
    throw new Error("auth.json 中未找到 openai 配置")
  }
  return ((value as { openai: AuthEntry }).openai ?? {}) as AuthEntry
}

async function refresh(entry: AuthEntry): Promise<{ access: string; accountId?: string }> {
  if (!entry.refresh) throw new Error("缺少 ChatGPT OAuth refresh token")
  const response = await fetch("https://auth.openai.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: entry.refresh,
      client_id: CLIENT_ID,
    }),
  })
  if (!response.ok)
    throw new Error(`OAuth 刷新失败（HTTP ${response.status}）：${redactProbeError(await response.text())}`)
  const value = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!value.access_token) throw new Error("OAuth 刷新响应缺少 access_token")
  return { access: value.access_token, accountId: entry.accountId }
}

async function main() {
  const authFile = argument("--auth-file", DEFAULT_AUTH_FILE)
  const endpoint = argument("--endpoint", DEFAULT_ENDPOINT)
  const prompt = argument("--prompt", "生成一张简单的蓝色圆形图标")
  const model = argument("--model", "gpt-5.5")
  const entry = await readAuth(authFile)
  if (entry.type !== "oauth") throw new Error("openai 配置不是 OAuth 类型")
  const credentials =
    entry.access && entry.expires && entry.expires > Date.now()
      ? { access: entry.access, accountId: entry.accountId }
      : await refresh(entry)
  const headers = new Headers({
    Authorization: `Bearer ${credentials.access}`,
    "Content-Type": "application/json",
    originator: "opencode",
  })
  if (credentials.accountId) headers.set("ChatGPT-Account-Id", credentials.accountId)
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(buildChatGptImageProbeBody(prompt, model)),
  })
  const contentType = response.headers.get("content-type") ?? ""
  const text = await response.text()
  const isEventStream =
    contentType.includes("text/event-stream") || text.startsWith("event:") || text.includes("\ndata:")
  const summary = isEventStream ? summarizeChatGptImageProbeStream(text) : summarizeResponse(text)
  console.log(
    JSON.stringify({ status: response.status, contentType, responseBytes: Buffer.byteLength(text), ...summary }),
  )
  if (!response.ok) process.exitCode = 1
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(JSON.stringify({ error: redactProbeError(message) }))
  process.exitCode = 1
})

function summarizeResponse(text: string) {
  try {
    return summarizeChatGptImageProbeResponse(JSON.parse(text) as unknown)
  } catch {
    return summarizeChatGptImageProbeResponse({ error: text })
  }
}
