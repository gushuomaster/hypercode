export type PlusImportFile = {
  name: string
  filePath?: string
  segmentID?: string
}

export type PlusImportSegment = string | { segmentID: string; pending?: boolean }

export type PlusImportProposal = {
  name: string
  filePath?: string
  suggestedSegmentID?: string
  candidates: ReadonlyArray<string>
  confidence: "exact" | "candidate" | "none"
  reason: string
  requiresConfirmation: true
  accepted: false
}

export function matchAndPropose(
  files: ReadonlyArray<PlusImportFile>,
  segments: ReadonlyArray<PlusImportSegment> = [],
): ReadonlyArray<PlusImportProposal> {
  const knownSegments = [
    ...new Set(
      segments
        .map((segment) => (typeof segment === "string" ? segment : segment.segmentID))
        .map((segmentID) => segmentID.trim())
        .filter((segmentID): segmentID is string => Boolean(segmentID)),
    ),
  ]
  const pendingSegments = segments
    .flatMap((segment) => (typeof segment === "string" || segment.pending !== true ? [] : [segment.segmentID]))
    .filter((segmentID): segmentID is string => Boolean(segmentID?.trim()))
  return files.map((file) => {
    const explicit = normalizeSegmentID(file.segmentID)
    const filename = filenameSegmentID(file.name, knownSegments)
    const exact = explicit && knownSegments.some((segmentID) => segmentID.toLowerCase() === explicit.toLowerCase()) ? knownSegments.find((segmentID) => segmentID.toLowerCase() === explicit.toLowerCase()) : undefined
    const filenameMatch = filename && knownSegments.find((segmentID) => segmentID.toLowerCase() === filename.toLowerCase())
    const candidates = exact || filenameMatch ? [exact ?? filenameMatch!] : pendingSegments.length ? [...pendingSegments] : filename ? [filename] : []
    const suggestedSegmentID = exact ?? filenameMatch ?? (filename && knownSegments.length === 0 ? filename : undefined)
    const confidence = exact || filenameMatch ? "exact" : candidates.length ? "candidate" : "none"
    const reason = exact || filenameMatch
      ? "文件名或显式分段 ID 与目标分段匹配"
      : candidates.length
        ? "未找到明确分段 ID，仅列出待处理分段候选"
        : "未找到可验证的分段匹配"
    return {
      name: file.name,
      ...(file.filePath && { filePath: file.filePath }),
      ...(suggestedSegmentID && { suggestedSegmentID }),
      candidates,
      confidence,
      reason,
      requiresConfirmation: true,
      accepted: false,
    }
  })
}

export function normalizeSegmentID(value: string | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function filenameSegmentID(name: string, knownSegments: ReadonlyArray<string>) {
  const stem = name.trim().replace(/\.[^.\\/]+$/, "")
  if (!stem) return undefined
  const match = knownSegments
    .filter((segmentID) => stem.toLowerCase().includes(segmentID.toLowerCase()))
    .toSorted((left, right) => right.length - left.length || left.localeCompare(right))[0]
  if (match) return match
  const inferred = stem.replace(/(?:[-_](?:plus|image|output|generated|result))+(?:[-_].*)?$/i, "").trim()
  return inferred && inferred !== stem ? inferred : undefined
}

export * as PlusImport from "./plus-import"
