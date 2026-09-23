import type { ProductSessionInput } from "@opencode-ai/product"

type TuiSessionInput = {
  id: string
  title?: string
  parentID?: string
  time: {
    created?: number
    updated: number
    archived?: number
  }
}

export function toTuiProductSessionInput(
  session: TuiSessionInput,
  status?: { type: string },
  tags?: string[],
): ProductSessionInput {
  return {
    id: session.id,
    title: session.title,
    parentID: session.parentID,
    createdAt: session.time.created,
    updatedAt: session.time.updated,
    archivedAt: session.time.archived,
    status: status?.type,
    tags,
  }
}
