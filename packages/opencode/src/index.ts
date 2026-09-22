import { initializeCliLocale } from "./cli/locale"

await initializeCliLocale(process.cwd())
await import("./cli/main")
