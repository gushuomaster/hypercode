import { deriveProductLspStates, type ProductLspState } from "@opencode-ai/product"
import type { LspStatus } from "../core/sdk"

export function toProductLspStates(statuses: LspStatus[]): ProductLspState[] {
  return deriveProductLspStates(statuses.map((status) => ({
    id: status.id,
    name: status.name,
    root: status.root,
    status: status.status,
  })))
}
