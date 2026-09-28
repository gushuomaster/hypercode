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

export const sharedCommandContext = {
  supported: sharedCommandSupport,
  hasSession: true,
  canUndo: true,
  canRedo: true,
  hasVariants: true,
  hasConnectableProvider: true,
}

export const sharedCommandIDs = Object.keys(sharedCommandSupport).sort()
