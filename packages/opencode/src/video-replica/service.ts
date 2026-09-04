import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Context, Effect, Layer, Option } from "effect"
import * as Stream from "effect/Stream"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ModelsDev } from "@opencode-ai/core/models-dev"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { Skill } from "@/skill"
import { Question } from "@/question"
import { Auth } from "@/auth"
import { Agent } from "@/agent/agent"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import { LLMEvent } from "@opencode-ai/llm"
import { MessageID, SessionID } from "@/session/schema"
import { InstanceRef } from "@/effect/instance-ref"
import type { InstanceContext } from "@/project/instance-context"
import { ImageGenerationService } from "@/image-generation/service"
import { ImageGeneration } from "@/image-generation/schema"
import { ModelPool } from "./model-pool"
import { probeEndpoint, type HealthProbe } from "./model-health"
import { matchAndPropose, type PlusImportProposal } from "./plus-import"
import { calculateWorkflowMetrics, REQUIRED_METRICS, type WorkflowMetricName } from "./metrics"
import {
  APPROVAL_PHRASE,
  type Chapter,
  type ExternalProjectState,
  type GenerationWave,
  type HypercodeState,
  type ImageDecision,
  type ProviderAttempt,
  type Segment,
  type StoryboardQuestion,
  type WorkflowInput,
  decodeHypercodeState,
} from "./schema"
import {
  atomicWriteJson,
  ensureOutputDirectory,
  normalizePath,
  normalizeOutputPath,
  splitChapters,
  statePath,
  validateMediaFile,
} from "./paths"
import {
  DependencyError,
  SkillBridgeError,
  SkillBridge,
  type CommandResult,
  type DependencyReport,
  type DeliveryInput,
  type CreateVisualAssetPackInput,
  type VisualAssetPack,
  type InitProjectInput,
  type InspectVideoInput,
  type SkillBridgeLike,
} from "./skill-bridge"

export { APPROVAL_PHRASE }
export type { Chapter, GenerationWave, HypercodeState, ImageDecision, ProviderAttempt, Segment, StoryboardQuestion, WorkflowInput }
export type { SkillBridgeLike }

export type GeneratedImage = {
  segmentID: string
  filePath?: string
  provider?: string
  model?: string
  status?: string
  attempts?: number
  elapsedMs?: number
  cost?: { amount?: number; currency?: string; known: boolean }
}

export type GenerateImageInput = {
  workflowID: string
  segmentID: string
  segment: Segment
  referenceVideo: string
  productImages: ReadonlyArray<string>
  outputDirectory: string
  modelPool: ReadonlyArray<{ provider: string; model: string }>
  orchestrationPool?: ReadonlyArray<{ provider: string; model: string }>
  sessionID?: string
}

export type QualityInput = GenerateImageInput & { image: GeneratedImage }
export type QualityResult = { status: "accepted" | "rejected" | "uncertain"; reason?: string }

export type SemanticSegmentationInput = {
  workflowID: string
  sessionID?: string
  referenceVideo: string
  manifest: Readonly<Record<string, unknown>>
  chapters: ReadonlyArray<Chapter>
  models: ReadonlyArray<{ provider: string; model: string }>
}

export type VideoReplicaOptions = {
  readonly bridge?: SkillBridgeLike
  readonly bridgeFactory?: () => Promise<SkillBridgeLike>
  readonly skillLocation?: string
  readonly platform?: string
  readonly modelPool?: ModelPool.Snapshot | (() => ModelPool.Snapshot | Promise<ModelPool.Snapshot>)
  readonly approvedModels?: ReadonlyArray<string>
  readonly outputRoots?: ReadonlyArray<string>
  readonly dependencyConfirmation?: (missing: DependencyReport) => Promise<boolean>
  readonly generateImage?: (input: GenerateImageInput) => Promise<GeneratedImage>
  readonly qualityCheck?: (input: QualityInput) => Promise<QualityResult>
  readonly semanticSegmenter?: (input: SemanticSegmentationInput) => Promise<ReadonlyArray<Segment>>
  readonly generationConcurrency?: number
  readonly imageGeneration?: ImageGenerationService.Interface
  readonly question?: Pick<Question.Interface, "ask">
  readonly instance?: InstanceContext
  readonly now?: () => Date
}

export type StartResult = {
  workflowID: string
  outputDirectory: string
  segmentIDs: ReadonlyArray<string>
  chapters: ReadonlyArray<Chapter>
}

export type GenerationSummary = {
  workflowID: string
  generated: ReadonlyArray<GeneratedImage>
  skipped: ReadonlyArray<string>
  failed: ReadonlyArray<{ segmentID: string; reason: string }>
}

export type PlusImportResult = {
  workflowID: string
  filePath: string
  suggestedSegmentID?: string
  proposals?: ReadonlyArray<PlusImportProposal>
  requiresConfirmation: true
}

export type PlusImportConfirmation = {
  segmentID: string
  filePath?: string
  answer?: string
  decision?: "accepted" | "rejected"
}

export const PLUS_IMPORT_APPROVAL = "确认映射"
export const PLUS_IMPORT_CANCEL = "取消"

export type VisualAssetSelection =
  | { mode: "follow-source" }
  | { mode: "existing-pack"; packID: string; packVersion: number }
  | ({ mode: "create-pack" } & Partial<Omit<CreateVisualAssetPackInput, "assetRoot">> & { assetRoot?: string })

export type { VisualAssetPack }

export type DeliveryResult = {
  workflowID: string
  outputDirectory: string
  command?: ReadonlyArray<string>
}

export interface WorkflowRun extends StartResult {
  readonly providerAttempts: ReadonlyArray<HypercodeState["provider_attempts"][number]>
  readonly nextQuestion: () => Promise<StoryboardQuestion>
  readonly generate: () => Promise<GenerationSummary>
  readonly approveStoryboard: (segmentIDs: ReadonlyArray<string>, answer?: string) => Promise<WorkflowRun>
  readonly acceptImage: (segmentID: string, decision: ImageDecision) => Promise<WorkflowRun>
  readonly importPlusImage: (filePath: string) => Promise<PlusImportResult>
  readonly confirmPlusImage: {
    (segmentID: string, answer?: string, filePath?: string): Promise<WorkflowRun>
    (input: PlusImportConfirmation): Promise<WorkflowRun>
  }
  readonly compileDelivery: () => Promise<DeliveryResult>
  readonly selectVisualAssets: (selection: VisualAssetSelection) => Promise<WorkflowRun>
  readonly confirmModels: (answer: string) => Promise<WorkflowRun>
  readonly listVisualAssetPacks: () => Promise<ReadonlyArray<VisualAssetPack>>
  readonly createVisualAssetPack: (input: VisualAssetSelection & { mode: "create-pack" }) => Promise<WorkflowRun>
}

export interface Interface {
  readonly start: (input: WorkflowInput) => WorkflowRun
  readonly resume: (workflowID: string, skillLocation?: string) => Promise<WorkflowRun>
  readonly approveStoryboard: (
    workflowID: string,
    segmentIDs: ReadonlyArray<string>,
    answer?: string,
  ) => Promise<WorkflowRun>
  readonly acceptImage: (workflowID: string, segmentID: string, decision: ImageDecision) => Promise<WorkflowRun>
  readonly importPlusImage: (workflowID: string, filePath: string) => Promise<PlusImportResult>
  readonly confirmPlusImage: {
    (workflowID: string, segmentID: string, answer?: string, filePath?: string): Promise<WorkflowRun>
    (workflowID: string, input: PlusImportConfirmation): Promise<WorkflowRun>
  }
  readonly compileDelivery: (workflowID: string) => Promise<DeliveryResult>
  readonly selectVisualAssets: (workflowID: string, selection: VisualAssetSelection) => Promise<WorkflowRun>
  readonly confirmModels: (workflowID: string, answer: string) => Promise<WorkflowRun>
  readonly listVisualAssetPacks: (workflowID: string) => Promise<ReadonlyArray<VisualAssetPack>>
  readonly createVisualAssetPack: (workflowID: string, input: VisualAssetSelection & { mode: "create-pack" }) => Promise<WorkflowRun>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/VideoReplica") {}

export class WorkflowError extends Error {
  readonly workflowID?: string

  constructor(message: string, workflowID?: string) {
    super(message)
    this.name = "VideoReplicaWorkflowError"
    this.workflowID = workflowID
  }
}

export class ApprovalRequiredError extends WorkflowError {
  constructor(workflowID: string) {
    super(`Storyboard approval is required. Reply exactly: ${APPROVAL_PHRASE}`, workflowID)
    this.name = "VideoReplicaApprovalRequiredError"
  }
}

export class SkillUnavailableError extends WorkflowError {
  constructor(message: string) {
    super(message)
    this.name = "VideoReplicaSkillUnavailableError"
  }
}

export class StateError extends WorkflowError {
  constructor(message: string, workflowID?: string) {
    super(message, workflowID)
    this.name = "VideoReplicaStateError"
  }
}

type RecordState = {
  workflowID: string
  input: WorkflowInput
  outputDirectory: string
  state?: ExternalProjectState
  hypercode?: HypercodeState
  manifest: Record<string, unknown>
  segments: Segment[]
  chapters: Chapter[]
  generated: Map<string, GeneratedImage>
  imported: Map<string, GeneratedImage>
  plusImports: Map<string, PendingPlusImport>
  prepared: boolean
  dependenciesChecked: boolean
  visualAssetEntryPrepared: boolean
  visualAssetMappingPrepared: boolean
  chapterManifests: Record<number, Record<string, unknown>>
  skillFingerprint?: string
  visualAssetSelection?: VisualAssetSelection
  visualAssetPacks?: ReadonlyArray<VisualAssetPack>
  persisting?: Promise<void>
  preparing?: Promise<void>
  generating?: Promise<GenerationSummary>
  metricDurations: Partial<Record<WorkflowMetricName, number>>
  qualityChecks: NonNullable<HypercodeState["quality_checks"]>
  artifactPersisting?: Promise<void>
}

type PendingPlusImport = {
  id: string
  stagedPath: string
  proposal: PlusImportProposal
  at: string
}

const workflows = new Map<string, RecordState>()
const workflowLocations = new Map<string, string>()

export function createVideoReplicaService(options: VideoReplicaOptions = {}): Interface {
  const now = options.now ?? (() => new Date())
  const bridges = new Map<string, Promise<SkillBridgeLike>>()

  const resolveBridge = async (record?: RecordState) => {
    const requestedLocation = record?.input.skillLocation ?? options.skillLocation
    if (options.bridge && !requestedLocation) return options.bridge
    if (options.bridge && requestedLocation && options.bridge.source && normalizePath(options.bridge.source) === normalizePath(requestedLocation)) return options.bridge
    const key = requestedLocation ?? "__default__"
    const existing = bridges.get(key)
    if (existing) return existing
    const bridge = options.bridgeFactory
      ? options.bridgeFactory()
      : Promise.resolve(
          SkillBridge.createSkillBridge({
            skillLocation:
              requestedLocation ?? path.join(process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex"), "skills", "doubao-video-replica", "SKILL.md"),
            platform: options.platform,
          }),
        )
    bridges.set(key, bridge)
    return bridge
  }

  const start = (input: WorkflowInput): WorkflowRun => {
    const workflowID = crypto.randomUUID()
    const record: RecordState = {
      workflowID,
      input: { ...input, productImages: [...input.productImages] },
      outputDirectory: input.outputDirectory,
      manifest: {},
      segments: [],
      chapters: [],
      generated: new Map(),
      imported: new Map(),
      plusImports: new Map(),
      prepared: false,
      dependenciesChecked: false,
      visualAssetEntryPrepared: false,
      visualAssetMappingPrepared: false,
      chapterManifests: {},
      metricDurations: {},
      qualityChecks: [],
    }
    workflows.set(workflowID, record)
    workflowLocations.set(workflowID, input.outputDirectory)
    return runView(record)
  }

  const resume = async (workflowID: string, skillLocation?: string) => {
    const existing = workflows.get(workflowID)
    if (existing) {
      if (skillLocation) existing.input = { ...existing.input, skillLocation }
      existing.prepared = false
      existing.dependenciesChecked = false
      await prepare(existing, true)
      return runView(existing)
    }
    const indexedDirectory = workflowLocations.get(workflowID)
    const directory = indexedDirectory
      ? await verifyIndexedDirectory(indexedDirectory, workflowID).catch(() => undefined)
      : await findWorkflowDirectory(workflowID, options.outputRoots?.length ? options.outputRoots : [process.cwd()])
    if (!directory) throw new WorkflowError(`Workflow not found: ${workflowID}`, workflowID)
    const input = await readExternalState(statePath(directory))
    if (!input?.hypercode || input.hypercode.workflow_id !== workflowID)
      throw new StateError("project-state.json does not contain the requested workflow", workflowID)
    const index = await readWorkflowIndex(directory)
    const indexedInput = index?.workflow_id === workflowID ? inputFromIndex(index, directory) : inferInput(input, directory)
    const resumedSegments = readSegments(input)
    const record: RecordState = {
      workflowID,
      input: { ...indexedInput, ...(skillLocation && { skillLocation }) },
      outputDirectory: directory,
      state: input,
      hypercode: decodeHypercodeState(input.hypercode),
      manifest: {},
      segments: resumedSegments.length
        ? resumedSegments
        : input.hypercode.checkpoint.segment_ids.map((segment_id) => ({ segment_id })),
      chapters: [],
      generated: new Map(),
      imported: new Map(),
      plusImports: new Map(),
      prepared: false,
      dependenciesChecked: false,
      visualAssetEntryPrepared: false,
      visualAssetMappingPrepared: false,
      chapterManifests: {},
      metricDurations: input.hypercode?.metrics
        ? Object.fromEntries(REQUIRED_METRICS.map((name) => [name, input.hypercode?.metrics?.[name] ?? 0]))
        : {},
      qualityChecks: input.hypercode?.quality_checks?.map((item) => ({ ...item })) ?? [],
      ...(index?.skill_fingerprint && { skillFingerprint: index.skill_fingerprint }),
      ...(readVisualAssets(input)?.mode === "follow-source" && { visualAssetSelection: { mode: "follow-source" } as const }),
      ...(readVisualAssets(input)?.mode === "pack" && { visualAssetSelection: { mode: "existing-pack", packID: String(readString(readVisualAssets(input)?.pack_snapshot, ["pack_id", "packId", "id"])), packVersion: Number(readNumber(readVisualAssets(input)?.pack_snapshot, ["version", "pack_version", "packVersion"])) } as const }),
    }
    const duration = getDuration(record.manifest, input)
    record.chapters = duration ? splitChapters(duration) : []
    workflows.set(workflowID, record)
    workflowLocations.set(workflowID, directory)
    await prepare(record, true)
    return runView(record)
  }

  const approveStoryboard = async (workflowID: string, segmentIDs: ReadonlyArray<string>, answer?: string) => {
    const record = requireWorkflow(workflowID)
    await prepare(record)
    if (answer !== APPROVAL_PHRASE) throw new ApprovalRequiredError(workflowID)
    const state = requireHypercode(record)
    if (state.pending_model_confirmations?.length)
      throw new ApprovalRequiredError(workflowID)
    const expected = new Set(allSegmentIDs(record, state))
    if (state.checkpoint.phase !== "approval" && state.checkpoint.phase !== "analysis") {
      if (state.checkpoint.phase !== "generation" || segmentIDs.length !== expected.size || new Set(segmentIDs).size !== expected.size)
        throw new WorkflowError("Storyboard has already been approved", workflowID)
      if (segmentIDs.every((id) => expected.has(id))) return runView(record)
    }
    if (segmentIDs.length !== expected.size || new Set(segmentIDs).size !== expected.size || segmentIDs.some((id) => !expected.has(id)))
      throw new WorkflowError("Storyboard approval must include every analyzed segment exactly once", workflowID)
    const bridge = await resolveBridge(record)
    await freezeVisualAssets(record, bridge)
    const at = now().toISOString()
    const approvals = [
      ...state.approvals,
      ...segmentIDs.map((segment_id) => ({ segment_id, decision: "storyboard-approved", at })),
    ]
    record.hypercode = {
      ...state,
      approvals,
      checkpoint: { phase: "generation", segment_ids: [...expected], pending_action: null },
    }
    await persist(record)
    return runView(record)
  }

  const selectVisualAssets = async (workflowID: string, selection: VisualAssetSelection) => {
    const record = requireWorkflow(workflowID)
    if (selection.mode === "existing-pack" && (!selection.packID.trim() || !Number.isInteger(selection.packVersion) || selection.packVersion < 1))
      throw new WorkflowError("An existing style pack requires a pack ID and positive version", workflowID)
    if (selection.mode === "create-pack") {
      const created = await createVisualAssetPackWithBridge(record, selection)
      const packID = readString(created, ["pack_id", "packId", "id"])
      const packVersion = readNumber(created, ["version", "pack_version", "packVersion"])
      if (!packID || packVersion === undefined)
        throw new SkillUnavailableError("The visual-asset manager did not return a registered pack ID and version")
      selection = { mode: "existing-pack", packID, packVersion }
    }
    record.visualAssetSelection = selection
    record.visualAssetEntryPrepared = false
    record.visualAssetMappingPrepared = false
    await prepare(record)
    if (record.prepared) {
      const bridge = await resolveBridge(record)
      const stateFile = statePath(record.outputDirectory)
      await prepareVisualAssetEntry(record, bridge, stateFile)
      await prepareVisualAssetMapping(record, bridge, stateFile)
      await persist(record)
    }
    return runView(record)
  }

  const listVisualAssetPacks = async (workflowID: string) => {
    const record = requireWorkflow(workflowID)
    const bridge = await resolveBridge(record)
    const assetRoot = visualAssetRoot()
    if (!bridge.listVisualAssetPacks && !bridge.runVisualAsset)
      throw new SkillUnavailableError("The skill does not expose the visual-asset manager")
    const packs = bridge.listVisualAssetPacks
      ? await bridge.listVisualAssetPacks(assetRoot)
      : await runVisualAssetManager(bridge, ["--root", assetRoot, "list-packs"], record.outputDirectory)
    if (!Array.isArray(packs) || packs.some((item) => typeof item !== "object" || item === null || Array.isArray(item)))
      throw new SkillUnavailableError("The visual-asset manager returned an invalid pack list")
    record.visualAssetPacks = packs as ReadonlyArray<VisualAssetPack>
    return record.visualAssetPacks
  }

  const createVisualAssetPack = async (workflowID: string, selection: VisualAssetSelection & { mode: "create-pack" }) => {
    const record = requireWorkflow(workflowID)
    const created = await createVisualAssetPackWithBridge(record, selection)
    const packID = readString(created, ["pack_id", "packId", "id"])
    const packVersion = readNumber(created, ["version", "pack_version", "packVersion"])
    if (!packID || packVersion === undefined) throw new SkillUnavailableError("The visual-asset manager did not return a registered pack ID and version")
    return selectVisualAssets(workflowID, { mode: "existing-pack", packID, packVersion })
  }

  async function createVisualAssetPackWithBridge(record: RecordState, selection: VisualAssetSelection & { mode: "create-pack" }) {
    const packID = selection.packID?.trim()
    const name = selection.name?.trim()
    const missing = [
      !packID && "packID",
      !name && "name",
      !selection.layersPath && "layersPath",
      !selection.propsPath && "propsPath",
      !selection.globalOperationsPath && "globalOperationsPath",
      !selection.negativeRulesPath && "negativeRulesPath",
    ].filter((item): item is string => Boolean(item))
    if (missing.length)
      throw new WorkflowError(`create-pack requires ${missing.join(", ")}; list available packs before retrying`, record.workflowID)
    if (!packID || !name || !selection.layersPath || !selection.propsPath || !selection.globalOperationsPath || !selection.negativeRulesPath)
      throw new WorkflowError("create-pack input is incomplete", record.workflowID)
    const bridge = await resolveBridge(record)
    const requiredPackID = packID
    const requiredName = name
    const requiredLayersPath = selection.layersPath
    const requiredPropsPath = selection.propsPath
    const requiredGlobalOperationsPath = selection.globalOperationsPath
    const requiredNegativeRulesPath = selection.negativeRulesPath
    const input: CreateVisualAssetPackInput = {
      assetRoot: selection.assetRoot?.trim() || visualAssetRoot(),
      packID: requiredPackID,
      name: requiredName,
      layersPath: requiredLayersPath,
      propsPath: requiredPropsPath,
      globalOperationsPath: requiredGlobalOperationsPath,
      negativeRulesPath: requiredNegativeRulesPath,
      ...(selection.followSourceLayers && { followSourceLayers: selection.followSourceLayers }),
    }
    if (bridge.createVisualAssetPack) return bridge.createVisualAssetPack(input)
    if (!bridge.runVisualAsset) throw new SkillUnavailableError("The skill does not expose the visual-asset manager")
    return (await runVisualAssetManager(
      bridge,
      [
        "--root",
        input.assetRoot,
        "create-pack",
        "--pack-id",
        input.packID,
        "--name",
        input.name,
        "--layers-json",
        input.layersPath,
        "--props-json",
        input.propsPath,
        "--global-operations-json",
        input.globalOperationsPath,
        "--negative-rules-json",
        input.negativeRulesPath,
        ...(input.followSourceLayers ?? []).flatMap((layer) => ["--follow-source-layer", layer]),
      ],
      path.dirname(record.outputDirectory),
    )) as VisualAssetPack
  }

  const confirmModels = async (workflowID: string, answer: string) => {
    const record = requireWorkflow(workflowID)
    const state = requireHypercode(record)
    if (answer !== "确认使用") throw new ApprovalRequiredError(workflowID)
    const paid = state.pending_paid_model_confirmations ?? []
    const confirmPaid = state.image_pool.length === 0
    record.hypercode = {
      ...state,
      approved_models: [...new Set([...state.approved_models, ...(state.pending_model_confirmations ?? []), ...(confirmPaid ? paid : [])])],
      image_pool: [...new Set([...state.image_pool, ...(confirmPaid ? state.paid_image_pool ?? [] : [])])],
      ...(confirmPaid && { image_failed_models: [] }),
      pending_model_confirmations: [],
      pending_paid_model_confirmations: confirmPaid ? [] : paid,
    }
    await persist(record)
    record.prepared = false
    return runView(record)
  }

  const acceptImage = async (workflowID: string, segmentID: string, decision: ImageDecision, allowPendingPlus = false, imageOverride?: GeneratedImage) => {
    const record = requireWorkflow(workflowID)
    await prepare(record, true)
    const state = requireHypercode(record)
    const all = allSegmentIDs(record, state)
    if (!all.includes(segmentID)) throw new WorkflowError(`Unknown segment: ${segmentID}`, workflowID)
    if ((decision === "accepted" || decision === "force-accepted") && !allowPendingPlus && hasPendingPlusMapping(record, segmentID, state))
      throw new WorkflowError(`Plus image mapping requires explicit confirmation. Reply exactly: ${PLUS_IMPORT_APPROVAL}`, workflowID)
    if (decision === "accepted" || decision === "force-accepted") {
      const previousDecision = latestDecisionsBySegment(state.approvals).get(segmentID)
      const previousQuality = [...record.qualityChecks].toReversed().find((item) => item.segment_id === segmentID)
      const image =
        imageOverride ??
        record.generated.get(segmentID) ??
        record.imported.get(segmentID) ??
        (previousDecision === "rejected" || (previousQuality && previousQuality.status !== "accepted")
          ? undefined
          : await findAcceptedArtifact(record.outputDirectory, segmentID))
      if (!image) throw new WorkflowError("An image must be generated or imported before acceptance", workflowID)
      if (image.filePath) {
        const safePath = normalizeOutputPath(record.outputDirectory, image.filePath)
        const stat = await fs.lstat(safePath).catch(() => undefined)
        if (!stat?.isFile() || stat.isSymbolicLink()) throw new WorkflowError("The generated image path is unsafe or unavailable", workflowID)
        image.filePath = safePath
      }
      if (!record.generated.has(segmentID) && image.filePath) record.imported.set(segmentID, image)
    }
    const at = now().toISOString()
    const approvals = [...state.approvals, { segment_id: segmentID, decision: String(decision), at }]
    const latestDecisions = latestDecisionsBySegment(approvals)
    const accepted = new Set(
      [...latestDecisions].filter(([, value]) => value === "accepted" || value === "force-accepted").map(([id]) => id),
    )
    const pending = all.filter((id) => !accepted.has(id))
    const nextPhase = decision === "rejected" || pending.length ? "generation" : "delivery"
    record.hypercode = {
      ...state,
      approvals,
      checkpoint: {
        phase: nextPhase,
        segment_ids: all,
        pending_action: nextPhase === "generation" ? "generate-rejected-segment" : null,
      },
    }
    if (decision === "rejected") {
      record.generated.delete(segmentID)
      record.imported.delete(segmentID)
      await persistGeneratedArtifacts(record)
    }
    await persist(record)
    return runView(record)
  }

  const importPlusImage = async (workflowID: string, filePath: string): Promise<PlusImportResult> => {
    const record = requireWorkflow(workflowID)
    await prepare(record, true)
    const ingestionStarted = performance.now()
    const safePath = await validateMediaFile(filePath, "image")
    const state = requireHypercode(record)
    const proposals = matchAndPropose(
      [{ name: path.basename(safePath), filePath: safePath }],
      allSegmentIDs(record, state).map((segmentID) => ({ segmentID, pending: !isAccepted(state, segmentID) })),
    )
    const proposal = proposals[0]
    if (!proposal) throw new WorkflowError("Plus image import did not produce a mapping proposal", workflowID)
    const stagedPath = await copyPendingPlusImage(record.outputDirectory, safePath, proposal.name)
    const pending: PendingPlusImport = {
      id: crypto.randomUUID(),
      stagedPath,
      proposal: { ...proposal, filePath: safePath },
      at: now().toISOString(),
    }
    record.plusImports.set(pending.id, pending)
    const proposedSegmentID = proposal.suggestedSegmentID
    if (proposedSegmentID && !isAccepted(state, proposedSegmentID)) {
      record.imported.set(proposedSegmentID, { segmentID: proposedSegmentID, filePath: stagedPath, status: "plus-imported" })
      record.hypercode = {
        ...state,
        approvals: [
          ...state.approvals,
          { segment_id: proposedSegmentID, decision: "plus-import-proposed", at: pending.at },
        ],
      }
    }
    await persistGeneratedArtifacts(record)
    await persistPendingPlusImports(record)
    trackMetric(record, "asset_ingestion_seconds", ingestionStarted)
    await persist(record)
    return {
      workflowID,
      filePath: safePath,
      ...(proposal.suggestedSegmentID && { suggestedSegmentID: proposal.suggestedSegmentID }),
      proposals,
      requiresConfirmation: true,
    }
  }

  const confirmPlusImage = async (
    workflowID: string,
    segmentOrInput: string | PlusImportConfirmation,
    answer?: string,
    filePath?: string,
  ): Promise<WorkflowRun> => {
    const record = requireWorkflow(workflowID)
    await prepare(record, true)
    const input = typeof segmentOrInput === "string" ? { segmentID: segmentOrInput, answer, filePath } : segmentOrInput
    const normalizedAnswer = input.answer?.trim()
    if (normalizedAnswer === PLUS_IMPORT_CANCEL || input.decision === "rejected") return runView(record)
    if (normalizedAnswer !== PLUS_IMPORT_APPROVAL && input.decision !== "accepted")
      throw new WorkflowError(`Plus image confirmation requires the exact answer: ${PLUS_IMPORT_APPROVAL}`, workflowID)
    const state = requireHypercode(record)
    const segmentID = input.segmentID.trim()
    const segment = record.segments.find((item) => item.segment_id === segmentID)
    if (!segment) throw new WorkflowError(`Unknown segment: ${input.segmentID}`, workflowID)
    const pendingImport = [...record.plusImports.values()]
      .filter((item) => item.proposal.suggestedSegmentID === segmentID || item.proposal.candidates.includes(segmentID) || !item.proposal.candidates.length)
      .toSorted((left, right) => right.at.localeCompare(left.at))[0]
    if (!pendingImport) throw new WorkflowError("No pending Plus image mapping exists for this segment", workflowID)
    if (pendingImport.proposal.confidence !== "exact" && !input.filePath)
      throw new WorkflowError("A safe image file path is required before confirming the Plus mapping", workflowID)
    const sourcePath = input.filePath
      ? await validateMediaFile(input.filePath, "image")
      : await validatePendingPlusImage(record, pendingImport.stagedPath)
    const importedPath = input.filePath ? await copyImportedImage(record.outputDirectory, sourcePath, segmentID) : sourcePath
    const image: GeneratedImage = { segmentID, filePath: importedPath, status: "plus-imported" }
    record.imported.set(segmentID, image)
    if (latestDecisionsBySegment(state.approvals).get(segmentID) !== "plus-import-proposed")
      record.hypercode = {
        ...state,
        approvals: [...state.approvals, { segment_id: segmentID, decision: "plus-import-proposed", at: now().toISOString() }],
      }
    const confirmed = await acceptImage(workflowID, segmentID, "accepted", true, image)
    record.plusImports.delete(pendingImport.id)
    await persistGeneratedArtifacts(record)
    await persistPendingPlusImports(record)
    await persist(record)
    return confirmed
  }

  const compileDelivery = async (workflowID: string): Promise<DeliveryResult> => {
    const record = requireWorkflow(workflowID)
    await prepare(record, true)
    const state = requireHypercode(record)
    const segmentIDs = allSegmentIDs(record, state)
    const accepted = new Map<string, string>()
    for (const segmentID of segmentIDs) {
      const image = record.generated.get(segmentID) ?? record.imported.get(segmentID)
      if (image?.filePath && isAccepted(state, segmentID)) accepted.set(segmentID, image.filePath)
    }
    for (const segmentID of segmentIDs) {
      if (accepted.has(segmentID)) continue
      const image = await findAcceptedArtifact(record.outputDirectory, segmentID)
      if (image?.filePath && isAccepted(state, segmentID)) accepted.set(segmentID, image.filePath)
    }
    const acceptedIDs = new Set(accepted.keys())
    if (acceptedIDs.size !== segmentIDs.length || segmentIDs.some((segmentID) => !acceptedIDs.has(segmentID)))
      throw new WorkflowError("Delivery requires an accepted first frame for every segment", workflowID)
    const bridge = await resolveBridge(record)
    if (!bridge.compileDelivery) throw new SkillUnavailableError("The skill delivery compiler is unavailable")
    const deliveryDirectory = await ensureOutputDirectory(path.join(record.outputDirectory, "delivery"))
    const segmentsPath = path.join(deliveryDirectory, "segments.json")
    const acceptedPath = path.join(deliveryDirectory, "accepted.json")
    const mappingsPath = path.join(deliveryDirectory, "mappings.json")
    const factsPath = path.join(deliveryDirectory, "facts.json")
    await Promise.all([
      atomicWriteJson(segmentsPath, record.segments),
      atomicWriteJson(acceptedPath, Object.fromEntries(accepted)),
      atomicWriteJson(
        mappingsPath,
        {
          mappings: record.segments.map((segment) => ({
            segment_id: segment.segment_id,
            blocked: false,
            coverage: {
              scene: { status: "follow-source", asset_refs: [], reason: "场景跟随参考视频" },
              hands: { status: "follow-source", asset_refs: [], reason: "手部跟随参考视频" },
              look: { status: "follow-source", asset_refs: [], reason: "视觉风格跟随参考视频" },
              camera: { status: "follow-source", asset_refs: [], reason: "镜头跟随参考视频" },
              props: { status: "follow-source", asset_refs: [], reason: "道具跟随参考视频" },
            },
          })),
        },
      ),
      atomicWriteJson(factsPath, {}),
    ])
    const output = await bridge.compileDelivery({
      segments: segmentsPath,
      mappings: mappingsPath,
      facts: factsPath,
      accepted: acceptedPath,
      approvalOutput: path.join(deliveryDirectory, "approval.md"),
      promptsOutput: path.join(deliveryDirectory, "prompts.md"),
    })
    const approvalFile = path.join(deliveryDirectory, "approval.md")
    const promptsFile = path.join(deliveryDirectory, "prompts.md")
    const [approvalStat, promptsStat] = await Promise.all([fs.lstat(approvalFile).catch(() => undefined), fs.lstat(promptsFile).catch(() => undefined)])
    if (output?.command && (!approvalStat?.isFile() || approvalStat.isSymbolicLink() || !promptsStat?.isFile() || promptsStat.isSymbolicLink()))
      throw new SkillUnavailableError("Delivery compiler did not produce approval.md and prompts.md")
    record.hypercode = {
      ...state,
      checkpoint: { phase: "delivery", segment_ids: [...segmentIDs], pending_action: null },
    }
    await persist(record)
    return { workflowID, outputDirectory: deliveryDirectory, ...(output && { command: output.command }) }
  }

  const generate = async (record: RecordState): Promise<GenerationSummary> => {
    if (record.generating) return record.generating
    const current = generateOnce(record)
    record.generating = current
    try {
      return await current
    } finally {
      if (record.generating === current) record.generating = undefined
    }
  }

  const generateOnce = async (record: RecordState): Promise<GenerationSummary> => {
    await prepare(record, true)
    const state = requireHypercode(record)
    if (state.pending_model_confirmations?.length)
      throw new WorkflowError(`首次使用以下图片模型需要用户确认：${state.pending_model_confirmations.join(", ")}`, record.workflowID)
    if (!state.image_pool.length && state.pending_paid_model_confirmations?.length)
      throw new WorkflowError(`Free image models are exhausted; paid model confirmation is required: ${state.pending_paid_model_confirmations.join(", ")}`, record.workflowID)
    if (state.checkpoint.phase !== "generation" && state.checkpoint.phase !== "qc")
      throw new ApprovalRequiredError(record.workflowID)
    const all = allSegmentIDs(record, state)
    const pending = all.filter((segmentID) => !isAccepted(state, segmentID) && !record.generated.has(segmentID))
    const skipped = all.filter((segmentID) => !pending.includes(segmentID))
    const generated: GeneratedImage[] = []
    const failed: Array<{ segmentID: string; reason: string }> = []
    const processSegment = async (segmentID: string) => {
      const segment = record.segments.find((item) => item.segment_id === segmentID)
      if (!segment) {
        failed.push({ segmentID, reason: "segment is missing from the analyzed project" })
        return
      }
      const input: GenerateImageInput = {
        workflowID: record.workflowID,
        segmentID,
        segment,
        referenceVideo: record.input.referenceVideo,
        productImages: record.input.productImages,
        outputDirectory: record.outputDirectory,
        modelPool: imagePool(record),
        orchestrationPool: orchestrationPool(record),
        sessionID: record.input.sessionID,
      }
      let acceptedImage: GeneratedImage | undefined
      let failureReason = "image generation failed"
      for (let qualityAttempt = 0; qualityAttempt < 2 && !acceptedImage; qualityAttempt++) {
        try {
          const generationStarted = performance.now()
          const image = await generateImage(input)
          trackMetric(record, "image_service_wait_seconds", generationStarted)
          if (options.qualityCheck) {
            const qualityStarted = performance.now()
            const quality = await options.qualityCheck({ ...input, image })
            trackMetric(record, "qc_prompt_state_dispatch_seconds", qualityStarted)
            await recordQualityCheck(record, segmentID, quality, qualityAttempt)
            if (quality.status !== "accepted") {
              failureReason = quality.reason ?? `quality check ${quality.status}`
              continue
            }
          }
          acceptedImage = image
        } catch (error) {
          if (error instanceof WorkflowError || error instanceof DependencyError || error instanceof SkillBridgeError) throw error
          failureReason = safeReason(error)
          const current = requireHypercode(record)
          const failedModels =
            error instanceof ImageGenerationService.GenerationError && error.failures?.length
              ? error.failures.map((failure) => `${failure.provider}/${failure.model}`)
              : input.modelPool.map((candidate) => `${candidate.provider}/${candidate.model}`)
          const attempted = [...new Set([...(current.image_failed_models ?? []), ...failedModels])]
          const remainingFree = current.image_pool.filter((model) => !attempted.includes(model))
          record.hypercode = {
            ...current,
            image_failed_models: attempted,
            ...(remainingFree.length === 0 && current.image_pool.length > 0 ? { image_pool: [] } : {}),
          }
          await persist(record)
          if (error instanceof ImageGenerationService.GenerationError && error.failures?.length) {
            await Promise.all(
              error.failures.map((failure) =>
                appendProviderAttempt(
                  record,
                  {
                    segmentID,
                    provider: failure.provider,
                    model: failure.model,
                    attempts: failure.attempts,
                    errorStatus: failure.status,
                    failureReason: failure.reason,
                  },
                  "failed",
                ),
              ),
            )
          }
          break
        }
      }
      if (!acceptedImage) {
        failed.push({ segmentID, reason: failureReason })
        const attempts = requireHypercode(record).provider_attempts
        if (!attempts.some((item) => item.segment_id === segmentID && item.status === "failed"))
          await appendProviderAttempt(record, { segmentID, provider: "unknown", model: "unknown" }, "failed")
        return
      }
      record.generated.set(segmentID, acceptedImage)
      await persistGeneratedArtifacts(record)
      generated.push(acceptedImage)
      await appendProviderAttempt(record, acceptedImage, "success")
    }
    const configuredConcurrency = options.generationConcurrency ?? 4
    const concurrency = Number.isFinite(configuredConcurrency)
      ? Math.max(1, Math.min(4, Math.floor(configuredConcurrency)))
      : 4
    const previousWaves = latestGenerationWaves(state)
    for (let index = 0, wave = previousWaves.length + 1; index < pending.length; index += concurrency, wave++) {
      const waveSegments = pending.slice(index, index + concurrency)
      const generatedBefore = generated.length
      const failedBefore = failed.length
      const started = performance.now()
      await Promise.all(waveSegments.map(processSegment))
      const waveImages = generated.slice(generatedBefore)
      const knownCosts = waveImages.filter((image) => image.cost?.known && image.cost.amount !== undefined)
      const waveReport: GenerationWave = {
        wave,
        concurrency,
        segment_ids: [...waveSegments],
        generated: generated.length - generatedBefore,
        failed: failed.length - failedBefore,
        model_switches: waveImages.filter((image) => (image.attempts ?? 1) > 2).length,
        elapsed_ms: Math.round(performance.now() - started),
        cost_known: knownCosts.length === waveImages.length && waveImages.length > 0,
        ...(knownCosts.length > 0 && { cost_amount: knownCosts.reduce((total, image) => total + (image.cost?.amount ?? 0), 0) }),
        ...(knownCosts.find((image) => image.cost?.currency)?.cost?.currency && {
          cost_currency: knownCosts.find((image) => image.cost?.currency)?.cost?.currency,
        }),
      }
      const afterWave = requireHypercode(record)
      record.hypercode = { ...afterWave, generation_waves: [...(afterWave.generation_waves ?? previousWaves), waveReport] }
      await persist(record)
    }
    const latest = requireHypercode(record)
    const allIDs = allSegmentIDs(record, latest)
    const remaining = allIDs.filter((segmentID) => !record.generated.has(segmentID) && !isAccepted(latest, segmentID))
    record.hypercode = {
      ...latest,
      checkpoint: {
        phase: remaining.length ? "generation" : "qc",
        segment_ids: allIDs,
        pending_action: remaining.length ? "generate-pending-segments" : null,
      },
    }
    await persist(record)
    return { workflowID: record.workflowID, generated, skipped, failed }
  }

  const nextQuestion = async (record: RecordState) => {
    if (record.input.sessionID && !record.visualAssetSelection) {
      return {
        questions: [
          {
            question: "在分析参考视频前，请选择视觉资产来源。",
            header: "视觉资产",
            options: [
              { label: "跟随参考视频", description: "场景、手部、视觉和镜头语言跟随对应参考片段。" },
              { label: "选择已有风格包", description: "使用已入库风格包的固定 ID 和版本。" },
              { label: "创建新风格包", description: "先通过视觉资产管理器创建，再返回选择固定版本。" },
            ],
            custom: false,
          },
        ],
      }
    }
    if (!record.visualAssetSelection) record.visualAssetSelection = { mode: "follow-source" }
    await prepare(record)
    const state = requireHypercode(record)
    if (state.pending_model_confirmations?.length) {
      return {
        questions: [
          {
            question: `以下图片模型尚未确认：${state.pending_model_confirmations.join(", ")}。是否允许本次使用？`,
            header: "确认图片模型",
            options: [
              { label: "确认使用", description: "允许本次工作流使用列出的图片模型。" },
              { label: "取消", description: "保持等待，不调用未确认模型。" },
            ],
            custom: false,
          },
        ],
      }
    }
    if (!state.image_pool.length && state.pending_paid_model_confirmations?.length) {
      return {
        questions: [{
          question: `Free image models are unavailable. Allow paid image models for this workflow? ${state.pending_paid_model_confirmations.join(", ")}`,
          header: "纭鍥剧墖妯″瀷",
          options: [
            { label: "纭浣跨敤", description: "Confirm paid image generation and its provider charges." },
            { label: "鍙栨秷", description: "Keep the workflow paused without paid generation." },
          ],
          custom: false,
          presentation: { tone: "payment" as const, facts: [{ label: "Paid models", value: state.pending_paid_model_confirmations.join(", ") }] },
        }],
      }
    }
    if (state.checkpoint.phase !== "approval") {
      return {
        questions: [
          {
            question: `工作流已进入 ${state.checkpoint.phase} 阶段。需要继续处理当前分段吗？`,
            header: "继续工作流",
            options: [{ label: "继续", description: "从已落盘检查点继续，不重复已完成调用。" }],
            custom: false,
            presentation: {
              facts: [
                { label: "阶段", value: state.checkpoint.phase },
                { label: "待处理分段", value: String(pendingSegmentIDs(record, state).length) },
              ],
            },
          },
        ],
      }
    }
    return {
      questions: [
        {
          question: `请审阅完整分镜。确认后请逐字回复：${APPROVAL_PHRASE}`,
          header: "批准分镜",
          options: [
            { label: APPROVAL_PHRASE, description: "冻结分镜并开始生成首帧图片。" },
          ],
          custom: false,
          presentation: {
            facts: [
              { label: "分段数", value: String(allSegmentIDs(record, state).length) },
              { label: "章节数", value: String(record.chapters.length) },
            ],
            tone: "warning" as const,
          },
        },
      ],
    }
  }

  const runView = (record: RecordState): WorkflowRun => ({
    get workflowID() {
      return record.workflowID
    },
    get outputDirectory() {
      return record.outputDirectory
    },
    get segmentIDs() {
      return allSegmentIDs(record, record.hypercode)
    },
    get chapters() {
      return [...record.chapters]
    },
    get providerAttempts() {
      return [...(record.hypercode?.provider_attempts ?? [])]
    },
    nextQuestion: () => nextQuestion(record),
    generate: () => generate(record),
    approveStoryboard: (segmentIDs, answer) => approveStoryboard(record.workflowID, segmentIDs, answer),
    acceptImage: (segmentID, decision) => acceptImage(record.workflowID, segmentID, decision),
    importPlusImage: (filePath) => importPlusImage(record.workflowID, filePath),
    confirmPlusImage: (input: string | PlusImportConfirmation, answer?: string, filePath?: string) =>
      typeof input === "string"
        ? confirmPlusImage(record.workflowID, input, answer, filePath)
        : confirmPlusImage(record.workflowID, input),
    compileDelivery: () => compileDelivery(record.workflowID),
    selectVisualAssets: (selection) => selectVisualAssets(record.workflowID, selection),
    confirmModels: (answer) => confirmModels(record.workflowID, answer),
    listVisualAssetPacks: () => listVisualAssetPacks(record.workflowID),
    createVisualAssetPack: (selection) => createVisualAssetPack(record.workflowID, selection),
  })

  return {
    start,
    resume,
    approveStoryboard,
    acceptImage,
    importPlusImage,
    confirmPlusImage,
    compileDelivery,
    selectVisualAssets,
    confirmModels,
    listVisualAssetPacks,
    createVisualAssetPack,
  }

  async function prepare(record: RecordState, resumeOnly = false) {
    if (record.prepared) return
    if (record.preparing) return record.preparing
    record.preparing = (async () => {
      if ((options.platform ?? process.platform) !== "win32") throw new WorkflowError("VideoReplica workflow requires Windows", record.workflowID)
      const outputDirectory = await ensureOutputDirectory(record.outputDirectory, { create: false })
      const referenceVideo = await validateMediaFile(record.input.referenceVideo, "video")
      if (!record.input.productImages.length) throw new WorkflowError("At least one product image is required", record.workflowID)
      const productImages = await Promise.all(record.input.productImages.map((image) => validateMediaFile(image, "image")))
      record.input = { ...record.input, referenceVideo, productImages }
      const stateFile = statePath(outputDirectory)
      record.state = await readExternalState(stateFile)
      const bridge = await resolveBridge(record)
      if (bridge.validateSkill) await bridge.validateSkill()
      const fingerprint = bridge.fingerprint ? await bridge.fingerprint() : undefined
      if (record.skillFingerprint && fingerprint && record.skillFingerprint !== fingerprint)
        throw new StateError("The installed video-replica skill changed since this workflow was created", record.workflowID)
      record.skillFingerprint = fingerprint ?? record.skillFingerprint
      if (!record.state && bridge.ensureDependencies && bridge.checkDependencies)
        await verifyToolDependencies(bridge)
      if (!record.state) {
        if (!bridge.initProject) throw new SkillUnavailableError("The skill init_project.py script is unavailable")
        await fs.mkdir(path.dirname(outputDirectory), { recursive: true })
        const productName = record.input.productName?.trim() || "Product"
        await bridge.initProject({
          outputDirectory,
          productName,
          referenceVideo,
          productImages,
          market: record.input.market,
        } satisfies InitProjectInput)
        record.outputDirectory = await ensureOutputDirectory(outputDirectory)
        record.state = await readExternalState(stateFile)
      }
      if (record.state) record.outputDirectory = await ensureOutputDirectory(outputDirectory)
      if (!record.state) record.state = {}
      if (Object.keys(record.manifest).length === 0) record.manifest = await readManifestArtifacts(record.outputDirectory)
      await prepareVisualAssetEntry(record, bridge, stateFile)
      await loadGeneratedArtifacts(record)
      await loadPendingPlusImports(record)
      await verifyDependencies(record, bridge, outputDirectory)
      if (!resumeOnly || !record.manifest || Object.keys(record.manifest).length === 0) {
        if (!bridge.inspectVideo) throw new SkillUnavailableError("The skill inspect_video.py script is unavailable")
        const analysis = await inspectChapters(record, bridge, referenceVideo, outputDirectory)
        record.manifest = analysis.manifest
        record.chapters = analysis.chapters
      }
      const duration = getDuration(record.manifest, record.state)
      if (!record.chapters.length) record.chapters = duration ? splitChapters(duration) : [{ chapter: 1, startSeconds: 0, endSeconds: 0, durationSeconds: 0 }]
      record.segments = readSegments(record.state)
      if (!record.segments.length) record.segments = readSegments(record.manifest)
      const modelSnapshot = await readModelSnapshot()
      const current = record.state.hypercode
      if (current !== undefined && !isHypercodeLike(current))
        throw new StateError("project-state.json contains an invalid hypercode checkpoint", record.workflowID)
      if (current && current.workflow_id !== record.workflowID)
        throw new StateError("project-state.json belongs to a different workflow", record.workflowID)
      record.hypercode = current ? decodeHypercodeState(current) : createHypercode(record, modelSnapshot)
      if (!record.segments.length && record.hypercode.pending_model_confirmations?.length) {
        syncMetrics(record)
        record.hypercode = { ...record.hypercode, quality_checks: record.qualityChecks }
        await persist(record)
        record.prepared = true
        return
      }
      if (!record.segments.length && options.semanticSegmenter) {
        const started = performance.now()
        const approved = new Set(record.hypercode.approved_models)
        const proposed = await options.semanticSegmenter({
          workflowID: record.workflowID,
          sessionID: record.input.sessionID,
          referenceVideo,
          manifest: record.manifest,
          chapters: record.chapters,
          models: modelSnapshot?.orchestration
            .filter((candidate) => !candidate.requiresConfirmation || approved.has(`${candidate.providerID}/${candidate.modelID}`) || approved.has(candidate.modelID))
            .map((candidate) => ({ provider: candidate.providerID, model: candidate.modelID })) ?? [],
        })
        trackMetric(record, "other_agent_compute_seconds", started)
        record.segments = readSegments({ segments: proposed })
        if (record.segments.length) record.state = { ...record.state, segments: record.segments }
      }
      if (!record.segments.length)
        throw new StateError(
          "Video analysis produced visual evidence but no semantic segments; configure a semantic segmenter before continuing",
          record.workflowID,
        )
      record.segments = record.segments.map((segment) => ({
        source_frame: "",
        action_state: {},
        visible_hands: [],
        scene: {},
        product_required: true,
        props: [],
        look_required: false,
        camera: {},
        ...segment,
      }))
      validateSemanticSegments(record.segments, record.workflowID)
      await prepareVisualAssetMapping(record, bridge, stateFile)
      if (record.segments.length) record.state = { ...record.state, segments: record.segments }
      syncMetrics(record)
      record.hypercode = { ...record.hypercode, quality_checks: record.qualityChecks }
      const visualState = readVisualAssets(record.state)
      if (!visualState?.frozen_at && record.hypercode.checkpoint.phase !== "approval") {
        record.hypercode = {
          ...record.hypercode,
          approvals: [],
          checkpoint: {
            phase: "approval",
            segment_ids: record.segments.map((segment) => segment.segment_id),
            pending_action: APPROVAL_PHRASE,
          },
        }
      }
      if (!record.hypercode.checkpoint.segment_ids.length) {
        record.hypercode = {
          ...record.hypercode,
          checkpoint: {
            ...record.hypercode.checkpoint,
            phase: record.hypercode.checkpoint.phase === "analysis" ? "approval" : record.hypercode.checkpoint.phase,
            segment_ids: record.segments.map((segment) => segment.segment_id),
            pending_action: record.hypercode.checkpoint.phase === "analysis" ? APPROVAL_PHRASE : record.hypercode.checkpoint.pending_action,
          },
        }
      }
      await persist(record)
      record.prepared = true
    })().finally(() => {
      record.preparing = undefined
    })
    return record.preparing
  }

  async function verifyDependencies(record: RecordState, bridge: SkillBridgeLike, projectDirectory: string) {
    if (record.dependenciesChecked) return
    if (bridge.ensureDependencies) {
      await bridge.ensureDependencies({
        projectDirectory,
        confirm: (missing) => confirmDependencyInstallation(record, missing),
      })
      record.dependenciesChecked = true
      return
    }
    if (!bridge.checkDependencies) {
      record.dependenciesChecked = true
      return
    }
    const report = await bridge.checkDependencies({ checkPythonPackages: true })
    if (report?.missing.length) throw new DependencyError(report.missing)
    record.dependenciesChecked = true
  }

  async function verifyToolDependencies(bridge: SkillBridgeLike) {
    if (!bridge.checkDependencies) return
    const report = await bridge.checkDependencies({ checkPythonPackages: false })
    if (report?.missing.length) throw new DependencyError(report.missing)
  }

  async function runVisualAssetPhase(
    bridge: SkillBridgeLike,
    script: Parameters<NonNullable<SkillBridgeLike["runVisualAsset"]>>[0],
    args: ReadonlyArray<string>,
    cwd: string,
  ) {
    if (!bridge.runVisualAsset)
      throw new SkillUnavailableError(`The skill does not expose the visual-asset compatibility script: ${script}`)
    const result = await bridge.runVisualAsset(script, args, cwd)
    if (result.exitCode !== 0) throw new SkillUnavailableError(`The visual-asset script failed: ${script}`)
    return result
  }

  async function prepareVisualAssetEntry(record: RecordState, bridge: SkillBridgeLike, stateFile: string) {
    if (record.visualAssetEntryPrepared) return
    const visual = readVisualAssets(record.state)
    const assetRoot = visualAssetRoot()
    if (record.visualAssetSelection?.mode === "existing-pack") {
      await runVisualAssetPhase(
        bridge,
        "configure_visual_assets.py",
        ["select-pack", "--project-state", stateFile, "--asset-root", assetRoot, "--pack-id", record.visualAssetSelection.packID, "--pack-version", String(record.visualAssetSelection.packVersion)],
        path.dirname(stateFile),
      )
      record.state = (await readExternalState(stateFile)) ?? record.state
    } else if (!visual || record.visualAssetSelection?.mode === "follow-source") {
      await runVisualAssetPhase(bridge, "configure_visual_assets.py", ["follow-source", "--project-state", stateFile], path.dirname(stateFile))
      record.state = (await readExternalState(stateFile)) ?? record.state
    }
    record.visualAssetEntryPrepared = true
  }

  async function prepareVisualAssetMapping(record: RecordState, bridge: SkillBridgeLike, stateFile: string) {
    if (record.visualAssetMappingPrepared) return
    const hypercodeDirectory = await ensureOutputDirectory(path.join(record.outputDirectory, ".hypercode"))
    const demandsPath = path.join(hypercodeDirectory, "visual-demands.json")
    const mappingPath = path.join(hypercodeDirectory, "visual-mapping.json")
    const overridesPath = path.join(hypercodeDirectory, "visual-overrides.json")
    const visual = readVisualAssets(record.state)
    if (visual?.frozen_at) {
      record.visualAssetMappingPrepared = true
      return
    }
    await atomicWriteJson(demandsPath, record.segments)
    await atomicWriteJson(overridesPath, visual?.segment_assignments ?? {})
    if (visual?.mode === "pack") {
      const snapshot = visual.pack_snapshot
      const packID = readString(snapshot, ["pack_id", "packId", "id"])
      const packVersion = readNumber(snapshot, ["version", "pack_version", "packVersion"])
      if (!packID || packVersion === undefined)
        throw new SkillUnavailableError("The selected visual-asset pack cannot be mapped by the installed skill")
      await runVisualAssetPhase(
        bridge,
        "match_visual_assets.py",
        [
          "--demands",
          demandsPath,
          "--pack-id",
          packID,
          "--pack-version",
          String(packVersion),
          "--asset-root",
          visualAssetRoot(),
          "--overrides",
          overridesPath,
          "--output",
          mappingPath,
        ],
        path.dirname(stateFile),
      )
    } else {
      await atomicWriteJson(
        mappingPath,
        {
          mappings: record.segments.map((segment) => ({
            segment_id: segment.segment_id,
            coverage: {
              scene: { status: "follow-source", asset_refs: [], reason: "场景跟随参考视频" },
              hands: { status: "follow-source", asset_refs: [], reason: "手部跟随参考视频" },
              look: { status: "follow-source", asset_refs: [], reason: "视觉风格跟随参考视频" },
              camera: { status: "follow-source", asset_refs: [], reason: "镜头跟随参考视频" },
              props: { status: "follow-source", asset_refs: [], reason: "道具跟随参考视频" },
            },
            hand_refs: [],
            resolved_operations: [],
            blocked: false,
            generation_references: [],
            source_action_state: {},
            source_hand_roles: [],
            product_required: true,
          })),
        },
      )
    }
    await runVisualAssetPhase(
      bridge,
      "configure_visual_assets.py",
      ["apply-mapping", "--project-state", stateFile, "--mapping", mappingPath],
      path.dirname(stateFile),
    )
    record.state = (await readExternalState(stateFile)) ?? record.state
    record.visualAssetMappingPrepared = true
  }

  async function freezeVisualAssets(record: RecordState, bridge: SkillBridgeLike) {
    const stateFile = statePath(record.outputDirectory)
    const visual = readVisualAssets(record.state)
    if (visual?.frozen_at) return
    await runVisualAssetPhase(
      bridge,
      "configure_visual_assets.py",
      ["freeze", "--project-state", stateFile, "--asset-root", visualAssetRoot(), "--approval-phrase", APPROVAL_PHRASE],
      path.dirname(stateFile),
    )
    record.state = (await readExternalState(stateFile)) ?? record.state
  }

  async function inspectChapters(
    record: RecordState,
    bridge: SkillBridgeLike,
    referenceVideo: string,
    outputDirectory: string,
  ) {
    const analysisRoot = await ensureOutputDirectory(path.join(outputDirectory, "analysis"))
    const knownDuration = getDuration(record.manifest, record.state ?? {})
    const initialChapter = knownDuration ? splitChapters(knownDuration)[0] : undefined
    const manifests: Record<string, unknown>[] = []
    let reuseManifestPath: string | undefined
    const inspectOne = async (chapter: Chapter, first = false) => {
      const analysisDirectory = path.join(analysisRoot, `chapter-${chapter.chapter}-${crypto.randomUUID()}`)
      const input: InspectVideoInput = {
        referenceVideo,
        outputDirectory: analysisDirectory,
        ...(first && !initialChapter
          ? {}
          : { exactWindows: [`${chapter.startSeconds}:${chapter.endSeconds}`] }),
        ...(!first && reuseManifestPath ? { reuseManifest: reuseManifestPath } : {}),
      }
      const value = await bridge.inspectVideo!(input)
      if (first && typeof value?.manifestPath === "string") reuseManifestPath = value.manifestPath
      const manifest = await loadManifest(value ?? {}, outputDirectory)
      record.chapterManifests[chapter.chapter] = manifest
      await atomicWriteJson(path.join(outputDirectory, ".hypercode", "chapter-manifests.json"), record.chapterManifests)
      if (record.hypercode) {
        record.hypercode = { ...record.hypercode, chapter: chapter.chapter, checkpoint: { ...record.hypercode.checkpoint, phase: "analysis", pending_action: `analyze-chapter-${chapter.chapter}` } }
        await persist(record)
      }
      manifests.push(manifest)
      return manifest
    }

    const firstManifest = await inspectOne(initialChapter ?? { chapter: 1, startSeconds: 0, endSeconds: 0, durationSeconds: 0 }, true)
    const duration = getDuration(firstManifest, record.state ?? {})
    const chapters = duration ? splitChapters(duration) : [{ chapter: 1, startSeconds: 0, endSeconds: 0, durationSeconds: 0 }]
    if (chapters.length > 1 && !record.chapterManifests[chapters[0]!.chapter]) {
      await inspectOne(chapters[0]!)
    }
    for (const chapter of chapters.slice(1)) {
      if (record.chapterManifests[chapter.chapter]) continue
      await inspectOne(chapter)
    }
    const merged = {
      chapters,
      chapter_manifests: record.chapterManifests,
      segments: manifests.flatMap((manifest) => (Array.isArray(manifest.segments) ? manifest.segments : [])),
      manifests,
    }
    await atomicWriteJson(path.join(outputDirectory, ".hypercode", "canonical-manifest.json"), merged)
    await atomicWriteJson(path.join(outputDirectory, ".hypercode", "chapter-manifests.json"), record.chapterManifests)
    return { manifest: merged, chapters }
  }

  async function confirmDependencyInstallation(record: RecordState, missing: DependencyReport) {
    if (options.dependencyConfirmation) return options.dependencyConfirmation(missing)
    if (!options.question || !record.input.sessionID) return false
    const dependencyQuestion = options.question.ask({
        sessionID: SessionID.make(record.input.sessionID),
        questions: [
          {
            question: `Required workflow dependencies are missing: ${missing.missing.join(", ")}. Install them in an isolated project environment?`,
            header: "Install dependencies",
            options: [
              { label: "Install", description: "Create or update the project-local virtual environment." },
              { label: "Cancel", description: "Stop until dependencies are installed manually." },
            ],
            custom: false,
          },
        ],
      })
    const answers = await Effect.runPromise(options.instance ? dependencyQuestion.pipe(Effect.provideService(InstanceRef, options.instance)) : dependencyQuestion)
    return answers.some((answer) => answer.includes("Install"))
  }

  async function generateImage(input: GenerateImageInput) {
    if (options.generateImage) return options.generateImage(input)
    if (!options.imageGeneration) throw new WorkflowError("Image generation is delegated to the image-generation service", input.workflowID)
    const candidates = input.modelPool.filter((item): item is { provider: "nvidia" | "openai"; model: string } => item.provider === "nvidia" || item.provider === "openai")
    const generation = options.imageGeneration.generate({
        segmentID: input.segmentID,
        prompt: promptFor(input.segment),
        referenceImages: input.productImages,
        outputDirectory: input.outputDirectory,
        modelPool: candidates,
        width: 9,
        height: 16,
      } satisfies ImageGeneration.Request)
    const result = await Effect.runPromise(options.instance ? generation.pipe(Effect.provideService(InstanceRef, options.instance)) : generation)
    return {
      segmentID: result.segmentID,
      filePath: result.filePath,
      provider: result.provider,
      model: result.model,
      status: "generated",
      attempts: result.attempts,
      elapsedMs: result.elapsedMs,
      cost: result.cost,
    } satisfies GeneratedImage
  }

  async function appendProviderAttempt(
    record: RecordState,
    image: GeneratedImage & { errorStatus?: number; failureReason?: string },
    status: string,
  ) {
    const state = requireHypercode(record)
    record.hypercode = {
      ...state,
      provider_attempts: [
        ...state.provider_attempts,
        {
          provider: image.provider ?? "unknown",
          model: image.model ?? "unknown",
          status,
          at: now().toISOString(),
          ...(image.segmentID && { segment_id: image.segmentID }),
          ...(image.attempts !== undefined && { attempts: image.attempts }),
          ...(image.elapsedMs !== undefined && { elapsed_ms: image.elapsedMs }),
          ...(image.errorStatus !== undefined && { error_status: image.errorStatus }),
          ...(image.failureReason && { error_reason: redactSecrets(image.failureReason).slice(0, 500) }),
          ...(image.cost && {
            cost_known: image.cost.known,
            ...(image.cost.amount !== undefined && { cost_amount: image.cost.amount }),
            ...(image.cost.currency && { cost_currency: image.cost.currency }),
          }),
        },
      ],
    }
    await persist(record)
  }

  async function recordQualityCheck(record: RecordState, segmentID: string, result: QualityResult, attempt: number) {
    const entry = {
      segment_id: segmentID,
      status: result.status,
      ...(result.reason && { reason: redactSecrets(result.reason).slice(0, 500) }),
      attempt,
      at: now().toISOString(),
    } as const
    record.qualityChecks = [...record.qualityChecks, entry]
    const state = requireHypercode(record)
    record.hypercode = { ...state, quality_checks: record.qualityChecks }
    await persist(record)
  }

  async function persist(record: RecordState) {
    const write = async () => {
      if (!record.state) record.state = {}
      if (!record.hypercode) throw new StateError("hypercode checkpoint is unavailable", record.workflowID)
      record.state = { ...record.state, hypercode: record.hypercode }
      await atomicWriteJson(statePath(record.outputDirectory), record.state)
      await persistWorkflowIndex(record)
    }
    const current = (record.persisting ?? Promise.resolve()).then(write, write)
    record.persisting = current
    try {
      await current
    } finally {
      if (record.persisting === current) record.persisting = undefined
    }
  }

  async function readModelSnapshot() {
    if (!options.modelPool) return undefined
    const snapshot = typeof options.modelPool === "function" ? await options.modelPool() : options.modelPool
    return snapshot
  }

  function imagePool(record: RecordState) {
    const ids = record.hypercode?.image_pool ?? []
    const pending = new Set(record.hypercode?.pending_model_confirmations ?? [])
    const failed = new Set(record.hypercode?.image_failed_models ?? [])
    return ids.map((id) => {
      const slash = id.indexOf("/")
      const provider = slash > 0 ? id.slice(0, slash) : id
      const model = slash > 0 ? id.slice(slash + 1) : id
      return { provider, model }
    }).filter((candidate) => !pending.has(`${candidate.provider}/${candidate.model}`) && !failed.has(`${candidate.provider}/${candidate.model}`))
  }

  function orchestrationPool(record: RecordState) {
    const ids = record.hypercode?.orchestration_pool ?? []
    const pending = new Set(record.hypercode?.pending_model_confirmations ?? [])
    return ids
      .map((id) => {
        const slash = id.indexOf("/")
        return { provider: slash > 0 ? id.slice(0, slash) : id, model: slash > 0 ? id.slice(slash + 1) : id }
      })
      .filter((candidate) => !pending.has(`${candidate.provider}/${candidate.model}`))
  }

  function createHypercode(record: RecordState, snapshot?: ModelPool.Snapshot): HypercodeState {
    const orchestration = snapshot?.orchestration.map((item) => `${item.providerID}/${item.modelID}`) ?? []
    const image = snapshot?.image.map((item) => `${item.providerID}/${item.modelID}`) ?? []
    const paidImage = snapshot?.paidImage?.map((item) => `${item.providerID}/${item.modelID}`) ?? []
    const approved = new Set(options.approvedModels ?? [])
    const pending = [...(snapshot?.orchestration ?? []), ...(snapshot?.image ?? [])]
      .filter((item) => item.requiresConfirmation && !approved.has(`${item.providerID}/${item.modelID}`) && !approved.has(item.modelID))
      .map((item) => `${item.providerID}/${item.modelID}`) ?? []
    return {
      schema_version: 1,
      workflow_id: record.workflowID,
      chapter: 1,
      orchestration_pool: orchestration,
      image_pool: image,
      image_failed_models: [],
      paid_image_pool: paidImage,
      approved_models: [...(options.approvedModels ?? [])],
      checkpoint: {
        phase: "approval",
        segment_ids: record.segments.map((segment) => segment.segment_id),
        pending_action: APPROVAL_PHRASE,
      },
      approvals: [],
      provider_attempts: [],
      generation_waves: [],
      pending_model_confirmations: pending,
      pending_paid_model_confirmations: paidImage,
    }
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Effect.serviceOption(Skill.Service)
    const instance = yield* InstanceRef
    const bridge = yield* SkillBridge.Service
    const image = yield* ImageGenerationService.Service
    const question = yield* Question.Service
    const auth = yield* Effect.serviceOption(Auth.Service)
    const llm = yield* Effect.serviceOption(LLM.Service)
    const provider = yield* Effect.serviceOption(Provider.Service)
    const agents = yield* Effect.serviceOption(Agent.Service)
    const modelsDev = yield* Effect.serviceOption(ModelsDev.Service)
    const skillLocation =
      Option.isSome(skill) && instance
        ? yield* skill.value.require("doubao-video-replica").pipe(
            Effect.map((info) => info.location),
            Effect.catch(() => Effect.succeed(undefined)),
          )
        : undefined
    const modelPool = Option.isSome(modelsDev)
        ? async () => {
          const catalog = await Effect.runPromise(modelsDev.value.get())
          const endpointChecks = new Map<string, ReturnType<typeof probeEndpoint>>()
          const healthProbe: HealthProbe = async (candidate) => {
            const provider = catalog[candidate.providerID]
            const model = provider?.models[candidate.modelID]
            if (!provider || !model) return { healthy: false, reason: "model is missing from the current catalog" }
            const configured = provider.env.some((name) => Boolean(process.env[name]?.trim()))
            const authenticated = Option.isSome(auth)
              ? Boolean(await Effect.runPromise(auth.value.get(candidate.providerID)).catch(() => undefined))
              : false
            if (!configured && !authenticated) return { healthy: false, reason: "provider credentials are not configured" }
            if (!provider.api) return { healthy: true, reason: "catalog entry and provider credentials are available; endpoint URL is not declared" }
            const endpointCheck = endpointChecks.get(provider.api) ?? probeEndpoint(provider.api)
            endpointChecks.set(provider.api, endpointCheck)
            const endpoint = await endpointCheck
            if (!endpoint.healthy) return { healthy: false, reason: endpoint.reason, status: endpoint.status }
            return {
              healthy: true,
              reason: `catalog entry and provider credentials are available; ${endpoint.reason}`,
              status: endpoint.status,
            }
          }
          const config: ModelPool.ModelPoolConfig = {
            providers: ["nvidia", "openai"],
            healthProbe,
          }
          const [free, paid] = await Promise.all([ModelPool.discover(catalog, config), ModelPool.discoverPaidImage(catalog, config)])
          return { ...free, paidImage: paid.paidImage }
        }
      : undefined
    const semanticSegmenter = Option.isSome(llm) && Option.isSome(provider) && Option.isSome(agents)
      ? async (input: SemanticSegmentationInput) => {
          if (!input.sessionID) throw new WorkflowError("Semantic orchestration requires a session context", input.workflowID)
          if (!input.models.length) throw new WorkflowError("No confirmed orchestration model is available", input.workflowID)
          const failures: string[] = []
          for (const candidate of input.models) {
            try {
              const model = await Effect.runPromise(provider.value.getModel(ProviderV2.ID.make(candidate.provider), ModelV2.ID.make(candidate.model)))
              const agent = await Effect.runPromise(agents.value.defaultInfo())
              const sessionID = SessionID.make(input.sessionID)
              const text = await Effect.runPromise(
                llm.value
                  .stream({
                    agent,
                    user: {
                      id: MessageID.ascending(),
                      sessionID,
                      role: "user",
                      time: { created: Date.now() },
                      agent: agent.name,
                      model: { providerID: model.providerID, modelID: model.id },
                    },
                    system: ["Return only a JSON array of semantic video segments. Do not include markdown fences."],
                    tools: {},
                    model,
                    sessionID,
                    retries: 1,
                    messages: [{
                      role: "user",
                      content: [
                        "Analyze the visual evidence and produce dynamic semantic segments. Each segment must have a unique segment_id, source_start_seconds, source_end_seconds, action_state, visible_hands, scene, camera, props, and product_required. Do not invent evidence outside the manifest.",
                        JSON.stringify({ manifest: input.manifest, chapters: input.chapters }),
                      ].join("\n\n"),
                    }],
                  })
                  .pipe(Stream.filter(LLMEvent.is.textDelta), Stream.map((event) => event.text), Stream.mkString),
              )
              const segments = parseSemanticSegmentOutput(text)
              if (segments.length) return segments
              failures.push(`${candidate.provider}/${candidate.model}: empty segment result`)
            } catch (error) {
              failures.push(`${candidate.provider}/${candidate.model}: ${safeReason(error)}`)
            }
          }
          throw new WorkflowError(`All confirmed orchestration models failed: ${failures.join("; ")}`, input.workflowID)
        }
      : undefined
    const qualityCheck = Option.isSome(llm) && Option.isSome(provider) && Option.isSome(agents)
      ? async (input: QualityInput): Promise<QualityResult> => {
          if (!input.sessionID || !input.orchestrationPool?.length || !input.image.filePath)
            return { status: "uncertain", reason: "No confirmed quality model or generated image is available" }
          const generated = await readReviewImage(input.image.filePath)
          const reference = await readReviewImage(input.productImages[0])
          if (!generated || !reference) return { status: "uncertain", reason: "QC reference image could not be read" }
          const review = async (candidate: { provider: string; model: string }) => {
            const model = await Effect.runPromise(provider.value.getModel(ProviderV2.ID.make(candidate.provider), ModelV2.ID.make(candidate.model)))
            const agent = await Effect.runPromise(agents.value.defaultInfo())
            const sessionID = SessionID.make(input.sessionID!)
            const text = await Effect.runPromise(
              llm.value
                .stream({
                  agent,
                  user: {
                    id: MessageID.ascending(),
                    sessionID,
                    role: "user",
                    time: { created: Date.now() },
                    agent: agent.name,
                    model: { providerID: model.providerID, modelID: model.id },
                  },
                  system: ["Return only JSON: {status: accepted|rejected|uncertain, reason: string}."],
                  tools: {},
                  model,
                  sessionID,
                  retries: 1,
                  messages: [{
                    role: "user",
                    content: [
                      { type: "text", text: "Perform strict first-frame QC. Reject visible product identity, logo, shape, interface, material, composition, watermark, subtitle, duplicate-product, or rendering artifact mismatches. Use uncertain only when evidence is insufficient." },
                      { type: "text", text: `Segment: ${input.segmentID}\nPrompt: ${promptFor(input.segment)}` },
                      { type: "text", text: "Product reference image:" },
                      { type: "image", image: reference.dataUrl },
                      { type: "text", text: "Generated first frame:" },
                      { type: "image", image: generated.dataUrl },
                    ],
                  }],
                })
                .pipe(Stream.filter(LLMEvent.is.textDelta), Stream.map((event) => event.text), Stream.mkString),
            )
            return parseQualityOutput(text)
          }
          const first = await review(input.orchestrationPool[0]!)
          if (first.status !== "uncertain" || input.orchestrationPool.length < 2) return first
          return review(input.orchestrationPool[1]!)
        }
      : undefined
    return Service.of(
      createVideoReplicaService({
        bridge: skillLocation ? undefined : bridge,
        imageGeneration: image,
        question,
        instance,
        modelPool,
        semanticSegmenter,
        qualityCheck,
        skillLocation,
        platform: process.platform,
        outputRoots: [process.cwd()],
      }),
    )
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(SkillBridge.defaultLayer),
  Layer.provide(ImageGenerationService.defaultLayer),
  Layer.provide(Question.defaultLayer),
  Layer.provide(Auth.defaultLayer),
  Layer.provide(ModelsDev.defaultLayer),
)

export const node = LayerNode.make(layer, [SkillBridge.node, ImageGenerationService.node, Question.node, Auth.node, Skill.node, ModelsDev.node])

export async function readState(outputDirectory: string) {
  const directory = await ensureOutputDirectory(outputDirectory, { create: false })
  return readExternalState(statePath(directory))
}

function requireWorkflow(workflowID: string) {
  const record = workflows.get(workflowID)
  if (!record) throw new WorkflowError(`Workflow not found: ${workflowID}`, workflowID)
  return record
}

function requireHypercode(record: RecordState) {
  if (!record.hypercode) throw new StateError("hypercode checkpoint is unavailable", record.workflowID)
  return record.hypercode
}

function syncMetrics(record: RecordState) {
  if (!record.hypercode) return
  const input = Object.fromEntries(REQUIRED_METRICS.map((name) => [name, record.metricDurations[name] ?? 0])) as Partial<Record<WorkflowMetricName, number>>
  record.hypercode = { ...record.hypercode, metrics: calculateWorkflowMetrics(input) }
}

function trackMetric(record: RecordState, name: WorkflowMetricName, startedAt: number) {
  record.metricDurations[name] = (record.metricDurations[name] ?? 0) + Math.max(0, (performance.now() - startedAt) / 1000)
  syncMetrics(record)
}

function isAccepted(state: HypercodeState, segmentID: string) {
  const decision = latestDecisionsBySegment(state.approvals).get(segmentID)
  return decision === "accepted" || decision === "force-accepted"
}

function latestDecisionsBySegment(approvals: HypercodeState["approvals"]) {
  const latest = new Map<string, string>()
  for (const item of approvals) latest.set(item.segment_id, item.decision)
  return latest
}

function latestGenerationWaves(state: HypercodeState) {
  return state.generation_waves?.map((item) => ({ ...item, segment_ids: [...item.segment_ids] })) ?? []
}

function allSegmentIDs(record: Pick<RecordState, "segments">, state?: HypercodeState) {
  const ids = new Set<string>()
  for (const segment of record.segments) ids.add(segment.segment_id)
  for (const segmentID of state?.checkpoint.segment_ids ?? []) ids.add(segmentID)
  for (const approval of state?.approvals ?? []) ids.add(approval.segment_id)
  return [...ids]
}

function pendingSegmentIDs(record: Pick<RecordState, "segments">, state: HypercodeState) {
  const accepted = new Set(
    [...latestDecisionsBySegment(state.approvals)]
      .filter(([, decision]) => decision === "accepted" || decision === "force-accepted")
      .map(([segmentID]) => segmentID),
  )
  return allSegmentIDs(record, state).filter((segmentID) => !accepted.has(segmentID))
}

function readSegments(value: ExternalProjectState | Record<string, unknown> | undefined): Segment[] {
  if (!value) return []
  const source = value as Record<string, unknown>
  const nested = ["segments", "generation_segments", "segment_demands", "storyboard_segments"]
    .map((key) => source[key])
    .find((candidate) =>
      Array.isArray(candidate)
        ? candidate.length > 0
        : typeof candidate === "object" && candidate !== null
          ? Object.keys(candidate).length > 0
          : false,
    )
  const raw = Array.isArray(nested)
    ? nested
    : typeof nested === "object" && nested !== null
      ? Object.entries(nested).map(([segment_id, segment]) => ({
          ...(typeof segment === "object" && segment !== null ? segment : {}),
          segment_id,
        }))
      : []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .flatMap((item) => {
      const segmentID = typeof item.segment_id === "string" ? item.segment_id : typeof item.id === "string" ? item.id : undefined
      return segmentID ? [{ ...item, segment_id: segmentID }] : []
    })
}

function validateSemanticSegments(segments: ReadonlyArray<Segment>, workflowID: string) {
  const seen = new Set<string>()
  for (const segment of segments) {
    if (seen.has(segment.segment_id)) throw new StateError(`Video analysis returned a duplicate semantic segment ID: ${segment.segment_id}`, workflowID)
    seen.add(segment.segment_id)
    const start = segment.source_start_seconds
    const end = segment.source_end_seconds
    if (start !== undefined && end !== undefined && (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start))
      throw new StateError(`Video analysis returned invalid timing for semantic segment: ${segment.segment_id}`, workflowID)
  }
}

function parseSemanticSegmentOutput(text: string) {
  const normalized = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
  const start = normalized.indexOf("[")
  const end = normalized.lastIndexOf("]")
  if (start < 0 || end <= start) throw new Error("orchestration output did not contain a JSON array")
  const value = JSON.parse(normalized.slice(start, end + 1)) as unknown
  const segments = readSegments({ segments: value })
  if (!segments.length) throw new Error("orchestration output contained no semantic segments")
  return segments
}

function parseQualityOutput(text: string): QualityResult {
  const normalized = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
  const start = normalized.indexOf("{")
  const end = normalized.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("QC output did not contain a JSON object")
  const value = JSON.parse(normalized.slice(start, end + 1)) as Record<string, unknown>
  const status = value.status
  if (status !== "accepted" && status !== "rejected" && status !== "uncertain") throw new Error("QC output contained an invalid status")
  return { status, ...(typeof value.reason === "string" && { reason: value.reason.slice(0, 500) }) }
}

async function readReviewImage(filePath: string | undefined) {
  if (!filePath) return undefined
  const bytes = await fs.readFile(filePath).catch(() => undefined)
  if (!bytes) return undefined
  const mimeType = reviewImageMime(bytes)
  if (!mimeType) return undefined
  return { dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}` }
}

function reviewImageMime(bytes: Uint8Array) {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png"
  if (bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return "image/jpeg"
  if (Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP") return "image/webp"
  return undefined
}

function inferInput(state: ExternalProjectState, outputDirectory: string): WorkflowInput {
  const sources = state.sources
  const source = typeof sources === "object" && sources !== null ? (sources as Record<string, unknown>) : {}
  const video = typeof source.primary_reference_video === "string" ? source.primary_reference_video : ""
  const images = Array.isArray(source.product_images) ? source.product_images.filter((item): item is string => typeof item === "string") : []
  const project = state.project
  const projectObject = typeof project === "object" && project !== null ? (project as Record<string, unknown>) : {}
  return {
    referenceVideo: video,
    productImages: images,
    outputDirectory,
    productName: typeof projectObject.product_name === "string" ? projectObject.product_name : undefined,
  }
}

function readVisualAssets(state: ExternalProjectState | undefined) {
  const value = state?.visual_assets
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function visualAssetRoot() {
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex")
  return path.join(codexHome, "assets", "doubao-video-replica")
}

function readString(value: unknown, keys: ReadonlyArray<string>) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  for (const key of keys) {
    const item = (value as Record<string, unknown>)[key]
    if (typeof item === "string" && item.trim()) return item
  }
  return undefined
}

function readNumber(value: unknown, keys: ReadonlyArray<string>) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  for (const key of keys) {
    const item = (value as Record<string, unknown>)[key]
    const number = typeof item === "number" ? item : typeof item === "string" && item.trim() ? Number(item) : Number.NaN
    if (Number.isInteger(number) && number > 0) return number
  }
  return undefined
}

function isHypercodeLike(value: unknown): value is HypercodeState {
  try {
    decodeHypercodeState(value)
    return true
  } catch {
    return false
  }
}

async function readExternalState(filePath: string): Promise<ExternalProjectState | undefined> {
  const content = await fs.readFile(filePath, "utf8").catch((error: unknown) => {
    if (isNotFound(error)) return undefined
    throw new StateError("project-state.json cannot be read")
  })
  if (content === undefined) return undefined
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    throw new StateError("project-state.json is not valid JSON")
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new StateError("project-state.json must contain an object")
  return value as ExternalProjectState
}

type WorkflowIndex = {
  schema_version: 1
  workflow_id: string
  output_directory: string
  reference_video: string
  product_images: ReadonlyArray<string>
  product_name?: string
  market?: string
  skill_location?: string
  skill_fingerprint?: string
  session_id?: string
}

async function readWorkflowIndex(directory: string): Promise<WorkflowIndex | undefined> {
  const filePath = path.join(directory, ".hypercode", "workflow-index.json")
  const content = await fs.readFile(filePath, "utf8").catch((error: unknown) => {
    if (isNotFound(error)) return undefined
    throw new StateError("workflow index cannot be read")
  })
  if (content === undefined) return undefined
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    throw new StateError("workflow index is not valid JSON")
  }
  if (!isWorkflowIndex(value)) throw new StateError("workflow index has an invalid schema")
  return value
}

function isWorkflowIndex(value: unknown): value is WorkflowIndex {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const source = value as Record<string, unknown>
  return (
    source.schema_version === 1 &&
    typeof source.workflow_id === "string" &&
    typeof source.output_directory === "string" &&
    typeof source.reference_video === "string" &&
    Array.isArray(source.product_images) &&
    source.product_images.every((item) => typeof item === "string") &&
    (source.product_name === undefined || typeof source.product_name === "string") &&
    (source.market === undefined || typeof source.market === "string") &&
    (source.skill_location === undefined || typeof source.skill_location === "string") &&
    (source.skill_fingerprint === undefined || typeof source.skill_fingerprint === "string")
    && (source.session_id === undefined || typeof source.session_id === "string")
  )
}

function inputFromIndex(index: WorkflowIndex, directory: string): WorkflowInput {
  return {
    referenceVideo: index.reference_video,
    productImages: [...index.product_images],
    outputDirectory: directory,
    ...(index.product_name && { productName: index.product_name }),
    ...(index.market && { market: index.market }),
    ...(index.session_id && { sessionID: index.session_id }),
    ...(index.skill_location && { skillLocation: index.skill_location }),
  }
}

async function verifyIndexedDirectory(candidate: string, workflowID: string) {
  const directory = await ensureOutputDirectory(candidate, { create: false })
  const index = await readWorkflowIndex(directory)
  if (!index || index.workflow_id !== workflowID) throw new StateError("workflow index does not match the requested workflow", workflowID)
  if (normalizePath(index.output_directory) !== normalizePath(directory))
    throw new StateError("workflow index output directory does not match its location", workflowID)
  return directory
}

async function persistWorkflowIndex(record: RecordState) {
  const directory = await ensureOutputDirectory(path.join(record.outputDirectory, ".hypercode"))
  const index: WorkflowIndex = {
    schema_version: 1,
    workflow_id: record.workflowID,
    output_directory: record.outputDirectory,
    reference_video: record.input.referenceVideo,
    product_images: [...record.input.productImages],
    ...(record.input.productName && { product_name: record.input.productName }),
    ...(record.input.market && { market: record.input.market }),
    ...(record.input.sessionID && { session_id: record.input.sessionID }),
    ...(record.input.skillLocation && { skill_location: record.input.skillLocation }),
    ...(record.skillFingerprint && { skill_fingerprint: record.skillFingerprint }),
  }
  await atomicWriteJson(path.join(directory, "workflow-index.json"), index)
}

async function readManifestArtifacts(directory: string): Promise<Record<string, unknown>> {
  const manifestPath = path.join(directory, ".hypercode", "canonical-manifest.json")
  const stat = await fs.lstat(manifestPath).catch(() => undefined)
  if (!stat?.isFile() || stat.isSymbolicLink()) return {}
  const content = await fs.readFile(manifestPath, "utf8").catch(() => undefined)
  if (!content) return {}
  try {
    const value: unknown = JSON.parse(content)
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function loadManifest(value: Record<string, unknown>, outputDirectory?: string) {
  if (typeof value.manifestPath !== "string") return value
  const manifestPath = outputDirectory
    ? normalizeOutputPath(outputDirectory, value.manifestPath)
    : normalizePath(value.manifestPath)
  const content = await fs.readFile(manifestPath, "utf8").catch(() => undefined)
  if (!content) return value
  try {
    const parsed: unknown = JSON.parse(content)
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : value
  } catch {
    return value
  }
}

function getDuration(manifest: Record<string, unknown>, state: ExternalProjectState) {
  const video = typeof manifest.video === "object" && manifest.video !== null ? manifest.video as Record<string, unknown> : {}
  const values = [manifest.duration_seconds, manifest.duration, video.duration_seconds, video.duration, state.duration_seconds]
  for (const value of values) {
    const duration = parsePositiveDuration(value)
    if (duration !== undefined) return duration
  }
  return undefined
}

async function readDurationFromArtifacts(directory: string) {
  const manifest = await findFile(directory, "manifest.json", 12)
  if (!manifest) return undefined
  const content = await fs.readFile(manifest, "utf8").catch(() => undefined)
  if (!content) return undefined
  try {
    const value: unknown = JSON.parse(content)
    if (typeof value === "object" && value !== null) {
      const duration = (value as Record<string, unknown>).duration_seconds
      const parsed = parsePositiveDuration(duration)
      if (parsed !== undefined) return parsed
    }
  } catch {
    return undefined
  }
  return undefined
}

function parsePositiveDuration(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

async function findWorkflowDirectory(workflowID: string, roots: ReadonlyArray<string>) {
  for (const root of roots) {
    const found = await findWorkflowInDirectory(root, workflowID, 12)
    if (found) return found
  }
  return undefined
}

async function findWorkflowInDirectory(directory: string, workflowID: string, depth: number): Promise<string | undefined> {
  if (depth < 0) return undefined
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(directory, entry.name)
    if (entry.isFile() && entry.name === "workflow-index.json" && path.basename(path.dirname(full)) === ".hypercode") {
      const index = await readWorkflowIndex(path.dirname(path.dirname(full))).catch(() => undefined)
      if (index?.workflow_id === workflowID && normalizePath(index.output_directory) === normalizePath(path.dirname(path.dirname(full))))
        return path.dirname(path.dirname(full))
    }
    if (entry.isFile() && entry.name === "project-state.json") {
      const state = await readExternalState(full).catch(() => undefined)
      if (state?.hypercode?.workflow_id === workflowID) return path.dirname(full)
    }
    if (entry.isDirectory()) {
      const found = await findWorkflowInDirectory(full, workflowID, depth - 1)
      if (found) return found
    }
  }
  return undefined
}

async function findFile(directory: string, filename: string, depth: number): Promise<string | undefined> {
  if (depth < 0) return undefined
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(directory, entry.name)
    if (entry.isFile() && entry.name === filename) return full
    if (entry.isDirectory()) {
      const found = await findFile(full, filename, depth - 1)
      if (found) return found
    }
  }
  return undefined
}

function inferSegmentID(filename: string, segments: ReadonlyArray<Segment>) {
  const stem = path.basename(filename, path.extname(filename)).toLowerCase()
  return segments.find((segment) => stem.includes(segment.segment_id.toLowerCase()))?.segment_id
}

async function copyPendingPlusImage(outputDirectory: string, source: string, name: string) {
  const stem = path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9_-]+/g, "-") || "plus"
  return copyImportedImage(outputDirectory, source, stem)
}

async function validatePendingPlusImage(record: Pick<RecordState, "outputDirectory">, filePath: string) {
  const safePath = normalizeOutputPath(record.outputDirectory, filePath)
  return validateMediaFile(safePath, "image")
}

async function copyImportedImage(outputDirectory: string, source: string, segmentID: string) {
  const destinationDirectory = await ensureOutputDirectory(path.join(outputDirectory, "storyboards"))
  const extension = path.extname(source).toLowerCase() || ".png"
  const safeSegment = segmentID.replace(/[^a-zA-Z0-9_-]+/g, "-") || "segment"
  const destination = path.join(destinationDirectory, `${safeSegment}-plus-${crypto.randomUUID()}${extension}`)
  const temporary = `${destination}.${crypto.randomUUID()}.tmp`
  await fs.copyFile(source, temporary)
  try {
    await fs.rename(temporary, destination)
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined)
  }
  return await validateMediaFile(destination, "image")
}

async function loadGeneratedArtifacts(record: RecordState) {
  const filePath = path.join(record.outputDirectory, ".hypercode", "generated-images.json")
  const content = await fs.readFile(filePath, "utf8").catch(() => undefined)
  if (!content) return
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    return
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return
  for (const [segmentID, item] of Object.entries(value)) {
    if (typeof item !== "object" || item === null) continue
    const source = item as Record<string, unknown>
    if (typeof source.filePath !== "string") continue
    let file: string
    try {
      file = normalizeOutputPath(record.outputDirectory, source.filePath)
    } catch {
      continue
    }
    const stat = await fs.lstat(file).catch(() => undefined)
    if (!stat?.isFile() || stat.isSymbolicLink()) continue
    const image: GeneratedImage = {
      segmentID,
      filePath: file,
      ...(typeof source.provider === "string" && { provider: source.provider }),
      ...(typeof source.model === "string" && { model: source.model }),
      ...(typeof source.status === "string" && { status: source.status }),
      ...(typeof source.attempts === "number" && { attempts: source.attempts }),
      ...(typeof source.elapsedMs === "number" && { elapsedMs: source.elapsedMs }),
      ...(typeof source.cost === "object" && source.cost !== null && { cost: source.cost as GeneratedImage["cost"] }),
    }
    if (source.status === "plus-imported") record.imported.set(segmentID, image)
    else record.generated.set(segmentID, image)
  }
}

async function loadPendingPlusImports(record: RecordState) {
  const sidecar = await fs.readFile(path.join(record.outputDirectory, ".hypercode", "plus-imports.json"), "utf8").catch(() => undefined)
  if (sidecar) {
    try {
      const value = JSON.parse(sidecar) as unknown
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        for (const [id, item] of Object.entries(value)) {
          if (typeof item !== "object" || item === null || Array.isArray(item)) continue
          const source = item as Record<string, unknown>
          if (typeof source.stagedPath !== "string" || typeof source.at !== "string") continue
          const proposal = source.proposal
          if (!isPlusProposal(proposal)) continue
          const stagedPath = await validatePendingPlusImage(record, source.stagedPath).catch(() => undefined)
          if (stagedPath) record.plusImports.set(id, { id, stagedPath, proposal, at: source.at })
        }
      }
    } catch {
      return
    }
  }
  const approvals = record.hypercode?.approvals ?? []
  for (const approval of approvals) {
    if (approval.decision !== "plus-import-proposed") continue
    const image = record.imported.get(approval.segment_id)
    if (
      !image?.filePath ||
      [...record.plusImports.values()].some(
        (item) => item.proposal.suggestedSegmentID === approval.segment_id || item.proposal.candidates.includes(approval.segment_id),
      )
    )
      continue
    const proposal = matchAndPropose([{ name: path.basename(image.filePath), filePath: image.filePath, segmentID: approval.segment_id }], [approval.segment_id])[0]
    if (proposal) record.plusImports.set(approval.segment_id, { id: crypto.randomUUID(), stagedPath: image.filePath, proposal, at: approval.at })
  }
}

function isPlusProposal(value: unknown): value is PlusImportProposal {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const source = value as Record<string, unknown>
  return typeof source.name === "string" && Array.isArray(source.candidates) && source.candidates.every((item) => typeof item === "string") &&
    (source.confidence === "exact" || source.confidence === "candidate" || source.confidence === "none") && source.requiresConfirmation === true && source.accepted === false
}

async function persistPendingPlusImports(record: RecordState) {
  const directory = await ensureOutputDirectory(path.join(record.outputDirectory, ".hypercode"))
  await atomicWriteJson(path.join(directory, "plus-imports.json"), Object.fromEntries(record.plusImports))
}

function hasPendingPlusMapping(record: RecordState, segmentID: string, state: HypercodeState) {
  return [...record.plusImports.values()].some((item) => item.proposal.suggestedSegmentID === segmentID || item.proposal.candidates.includes(segmentID)) ||
    (latestDecisionsBySegment(state.approvals).get(segmentID) === "plus-import-proposed" && record.imported.has(segmentID))
}

async function persistGeneratedArtifacts(record: RecordState) {
  const write = async () => {
    const directory = await ensureOutputDirectory(path.join(record.outputDirectory, ".hypercode"))
    const entries = [...record.generated, ...record.imported].map(([segmentID, image]) => [
      segmentID,
      {
        filePath: image.filePath,
        provider: image.provider,
        model: image.model,
        status: image.status,
        attempts: image.attempts,
        elapsedMs: image.elapsedMs,
        cost: image.cost,
      },
    ])
    await atomicWriteJson(path.join(directory, "generated-images.json"), Object.fromEntries(entries))
  }
  const current = (record.artifactPersisting ?? Promise.resolve()).then(write, write)
  record.artifactPersisting = current
  try {
    await current
  } finally {
    if (record.artifactPersisting === current) record.artifactPersisting = undefined
  }
}

async function runVisualAssetManager(bridge: SkillBridgeLike, args: ReadonlyArray<string>, cwd: string) {
  if (!bridge.runVisualAsset) throw new SkillUnavailableError("The skill does not expose the visual-asset manager")
  const result = await bridge.runVisualAsset("manage_visual_assets.py", args, cwd)
  if (result.exitCode !== 0) throw new SkillUnavailableError("The visual-asset manager failed")
  const value = parseStructuredJSON(result.stdout)
  if (value === undefined) throw new SkillUnavailableError("The visual-asset manager returned invalid JSON")
  return value
}

function parseStructuredJSON(stdout: string): unknown {
  const text = stdout.trim()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    for (let start = 0; start < lines.length; start++) {
      try {
        return JSON.parse(lines.slice(start).join("\n")) as unknown
      } catch {
        continue
      }
    }
  }
  return undefined
}

async function findAcceptedArtifact(outputDirectory: string, segmentID: string): Promise<GeneratedImage | undefined> {
  const candidates: Array<{ filePath: string; priority: number; modified: number }> = []
  await collectImageArtifacts(outputDirectory, segmentID, candidates, 0)
  const candidate = candidates.toSorted((left, right) => right.priority - left.priority || right.modified - left.modified || left.filePath.localeCompare(right.filePath))[0]
  return candidate ? { segmentID, filePath: candidate.filePath, status: "artifact" } : undefined
}

async function collectImageArtifacts(
  directory: string,
  segmentID: string,
  candidates: Array<{ filePath: string; priority: number; modified: number }>,
  depth: number,
) {
  if (depth > 6) return
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectImageArtifacts(full, segmentID, candidates, depth + 1)
      continue
    }
    if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) continue
    if (!path.basename(entry.name, path.extname(entry.name)).toLowerCase().includes(segmentID.toLowerCase())) continue
    if (full.toLowerCase().split(/[\\/]+/).includes("analysis")) continue
    const name = entry.name.toLowerCase()
    const parent = full.toLowerCase()
    const priority =
      (parent.includes("storyboard") ? 4 : 0) +
      (parent.includes("final") ? 3 : 0) +
      (name.includes("accepted") ? 3 : 0) +
      (name.includes("plus") ? 2 : 0) +
      (name.includes("generated") ? 1 : 0)
    const stat = await fs.stat(full).catch(() => undefined)
    if (stat) candidates.push({ filePath: full, priority, modified: stat.mtimeMs })
  }
}

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"])

function promptFor(segment: Segment) {
  const state = segment.action_state
  if (typeof state === "object" && state !== null) {
    const event = (state as Record<string, unknown>).event
    if (typeof event === "string" && event.trim()) return event
  }
  return `根据批准分镜生成 ${segment.segment_id} 的 9:16 首帧，保持产品真实身份与起始状态。`
}

function safeReason(error: unknown) {
  if (error instanceof Error && error.message) return redactSecrets(error.message).slice(0, 500)
  return "image generation failed"
}

function redactSecrets(message: string) {
  return message.replace(/((?:api[_-]?key|token|secret|authorization|bearer)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

export * as VideoReplica from "./service"
