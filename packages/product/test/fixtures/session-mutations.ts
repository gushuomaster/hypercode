import type { ProductMutableSessionInput, ProductSessionMutationCapabilities } from "../../src"

export const supportedSessionMutations: ProductSessionMutationCapabilities = {
  rename: true,
  archive: true,
  share: true,
  unshare: true,
  tags: true,
}

export const unsupportedSessionMutations: ProductSessionMutationCapabilities = {
  rename: true,
  archive: false,
  share: true,
  unshare: true,
  tags: false,
}

export const mutableSession: ProductMutableSessionInput = {
  id: "session-a",
  title: "Session A",
  tags: ["docs"],
  available: true,
  capabilities: supportedSessionMutations,
}
