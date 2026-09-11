import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260904093350_skill_execution",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`skill_artifact\` (
          \`id\` text PRIMARY KEY,
          \`execution_id\` text NOT NULL,
          \`operation_id\` text NOT NULL,
          \`storage_path\` text NOT NULL,
          \`mime_type\` text NOT NULL,
          \`sha256\` text NOT NULL,
          \`size_bytes\` integer NOT NULL,
          \`lifecycle\` text DEFAULT 'staged' NOT NULL,
          \`provider\` text,
          \`model\` text,
          \`attempt\` integer,
          \`cost\` real,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_expires\` integer,
          \`time_cleaned\` integer,
          CONSTRAINT \`fk_skill_artifact_execution_id_skill_execution_id_fk\` FOREIGN KEY (\`execution_id\`) REFERENCES \`skill_execution\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`skill_execution\` (
          \`id\` text PRIMARY KEY,
          \`skill_name\` text NOT NULL,
          \`skill_fingerprint\` text NOT NULL,
          \`workflow_id\` text NOT NULL,
          \`session_id\` text,
          \`location_directory\` text NOT NULL,
          \`workspace_id\` text,
          \`status\` text DEFAULT 'pending' NOT NULL,
          \`revision\` integer DEFAULT 0 NOT NULL,
          \`result\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_completed\` integer,
          CONSTRAINT \`fk_skill_execution_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE SET NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE \`skill_operation\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT,
          \`execution_id\` text NOT NULL,
          \`skill_fingerprint\` text NOT NULL,
          \`workflow_id\` text NOT NULL,
          \`operation_id\` text NOT NULL,
          \`action_type\` text NOT NULL,
          \`status\` text DEFAULT 'pending' NOT NULL,
          \`attempt\` integer DEFAULT 0 NOT NULL,
          \`provider\` text,
          \`model\` text,
          \`cost\` text,
          \`result\` text,
          \`result_hash\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_completed\` integer,
          CONSTRAINT \`fk_skill_operation_execution_id_skill_execution_id_fk\` FOREIGN KEY (\`execution_id\`) REFERENCES \`skill_execution\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`skill_artifact_execution_operation_idx\` ON \`skill_artifact\` (\`execution_id\`,\`operation_id\`);`)
      yield* tx.run(`CREATE INDEX \`skill_artifact_lifecycle_expiry_idx\` ON \`skill_artifact\` (\`lifecycle\`,\`time_expires\`);`)
      yield* tx.run(`CREATE UNIQUE INDEX \`skill_execution_fingerprint_workflow_idx\` ON \`skill_execution\` (\`skill_fingerprint\`,\`workflow_id\`);`)
      yield* tx.run(`CREATE INDEX \`skill_execution_session_status_idx\` ON \`skill_execution\` (\`session_id\`,\`status\`);`)
      yield* tx.run(`CREATE INDEX \`skill_execution_location_status_idx\` ON \`skill_execution\` (\`location_directory\`,\`status\`);`)
      yield* tx.run(`CREATE UNIQUE INDEX \`skill_operation_identity_idx\` ON \`skill_operation\` (\`skill_fingerprint\`,\`workflow_id\`,\`operation_id\`);`)
      yield* tx.run(`CREATE INDEX \`skill_operation_execution_status_idx\` ON \`skill_operation\` (\`execution_id\`,\`status\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
