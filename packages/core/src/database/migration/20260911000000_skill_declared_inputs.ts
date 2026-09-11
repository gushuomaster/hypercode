import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260911000000_skill_declared_inputs",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run("ALTER TABLE `skill_execution` ADD COLUMN `declared_inputs` text DEFAULT '[]' NOT NULL;")
    })
  },
} satisfies DatabaseMigration.Migration
