import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { directoryColumn } from "../database/path"
import { Timestamps } from "../database/schema.sql"
import { SessionSchema } from "../session/schema"
import { SessionTable } from "../session/sql"
import { WorkspaceV2 } from "../workspace"

export type SkillExecutionStatus = "pending" | "running" | "waiting" | "succeeded" | "failed" | "cancelled"
export type SkillOperationStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled" | "uncertain"
export type SkillArtifactLifecycle = "staged" | "imported" | "expired" | "cleaned"

export const SkillExecutionTable = sqliteTable(
  "skill_execution",
  {
    id: text().primaryKey(),
    skill_name: text().notNull(),
    skill_fingerprint: text().notNull(),
    workflow_id: text().notNull(),
    session_id: text()
      .$type<SessionSchema.ID>()
      .references(() => SessionTable.id, { onDelete: "set null" }),
    location_directory: directoryColumn().notNull(),
    workspace_id: text().$type<WorkspaceV2.ID>(),
    declared_inputs: text({ mode: "json" }).$type<ReadonlyArray<string>>().notNull().default([]),
    status: text().$type<SkillExecutionStatus>().notNull().default("pending"),
    revision: integer().notNull().default(0),
    result: text({ mode: "json" }).$type<Record<string, unknown>>(),
    ...Timestamps,
    time_completed: integer(),
  },
  (table) => [
    uniqueIndex("skill_execution_fingerprint_workflow_idx").on(table.skill_fingerprint, table.workflow_id),
    index("skill_execution_session_status_idx").on(table.session_id, table.status),
    index("skill_execution_location_status_idx").on(table.location_directory, table.status),
  ],
)

export const SkillOperationTable = sqliteTable(
  "skill_operation",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    execution_id: text()
      .notNull()
      .references(() => SkillExecutionTable.id, { onDelete: "cascade" }),
    skill_fingerprint: text().notNull(),
    workflow_id: text().notNull(),
    operation_id: text().notNull(),
    action_type: text().notNull(),
    status: text().$type<SkillOperationStatus>().notNull().default("pending"),
    attempt: integer().notNull().default(0),
    provider: text(),
    model: text(),
    cost: text({ mode: "json" }).$type<Record<string, unknown>>(),
    result: text({ mode: "json" }).$type<Record<string, unknown>>(),
    result_hash: text(),
    ...Timestamps,
    time_completed: integer(),
  },
  (table) => [
    uniqueIndex("skill_operation_identity_idx").on(
      table.skill_fingerprint,
      table.workflow_id,
      table.operation_id,
    ),
    index("skill_operation_execution_status_idx").on(table.execution_id, table.status),
  ],
)

export const SkillArtifactTable = sqliteTable(
  "skill_artifact",
  {
    id: text().primaryKey(),
    execution_id: text()
      .notNull()
      .references(() => SkillExecutionTable.id, { onDelete: "cascade" }),
    operation_id: text().notNull(),
    storage_path: text().notNull(),
    mime_type: text().notNull(),
    sha256: text().notNull(),
    size_bytes: integer().notNull(),
    lifecycle: text().$type<SkillArtifactLifecycle>().notNull().default("staged"),
    provider: text(),
    model: text(),
    attempt: integer(),
    cost: real(),
    ...Timestamps,
    time_expires: integer(),
    time_cleaned: integer(),
  },
  (table) => [
    index("skill_artifact_execution_operation_idx").on(table.execution_id, table.operation_id),
    index("skill_artifact_lifecycle_expiry_idx").on(table.lifecycle, table.time_expires),
  ],
)
