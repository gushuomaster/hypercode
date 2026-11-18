import { deriveProductCommandCatalog, deriveProductCommandSessionContext, type ProductCommandSessionFacts } from "../../src/command"

export const sharedCommandSupport = {
  "session.new": true,
  "session.list": true,
  "agent.list": true,
  "model.list": true,
  "variant.list": true,
  "provider.connect": true,
  "mcp.list": true,
  "system.status": true,
  "session.compact": true,
  "session.undo": true,
  "session.redo": true,
  "skill.list": true,
  "theme.list": true,
  "help.show": true,
} as const

export const surfaceOptionalCommandSupport = {
  "session.rename": true,
  "session.share": true,
  "session.unshare": true,
  "session.fork": true,
} as const

export const sharedCommandContext = {
  supported: { ...sharedCommandSupport, ...surfaceOptionalCommandSupport },
  isShared: true,
  hasSession: true,
  canUndo: true,
  canRedo: true,
  hasVariants: true,
  hasConnectableProvider: true,
}

export const sharedCommandIDs = Object.keys(sharedCommandSupport).sort()
export const surfaceOptionalCommandIDs = Object.keys(surfaceOptionalCommandSupport).sort()

// 共享会话原始事实 fixture，两端用同一份数据断言可用性等价。
export const exampleSessionFacts: ProductCommandSessionFacts = {
  hasSession: true,
  messages: [
    { id: "m1", role: "user" },
    { id: "m2", role: "assistant" },
    { id: "m3", role: "user" },
  ],
  revertMessageID: "m3",
  shareURL: "https://share.example/abc",
}

// 无会话时的原始事实。
export const emptySessionFacts: ProductCommandSessionFacts = {
  hasSession: false,
  messages: [],
}

// 给两端的 adapter 测试用：从共享原始事实构造完整 Product 上下文。
export function contextFromFacts(facts: ProductCommandSessionFacts) {
  return {
    supported: { ...sharedCommandSupport, ...surfaceOptionalCommandSupport },
    hasVariants: true,
    hasConnectableProvider: true,
    ...deriveProductCommandSessionContext(facts),
  }
}
