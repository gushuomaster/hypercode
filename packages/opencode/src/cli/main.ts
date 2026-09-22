import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { RunCommand } from "./cmd/run"
import { GenerateCommand } from "./cmd/generate"
import { ConsoleCommand } from "./cmd/account"
import { ProvidersCommand } from "./cmd/providers"
import { AgentCommand } from "./cmd/agent"
import { UpgradeCommand } from "./cmd/upgrade"
import { UninstallCommand } from "./cmd/uninstall"
import { ModelsCommand } from "./cmd/models"
import { UI } from "./ui"
import { FormatError } from "./error"
import { ServeCommand } from "./cmd/serve"
import { DebugCommand } from "./cmd/debug"
import { StatsCommand } from "./cmd/stats"
import { McpCommand } from "./cmd/mcp"
import { GithubCommand } from "./cmd/github"
import { ExportCommand } from "./cmd/export"
import { ImportCommand } from "./cmd/import"
import { AttachCommand } from "./cmd/attach"
import { TuiThreadCommand } from "./cmd/tui"
import { AcpCommand } from "./cmd/acp"
import { EOL } from "os"
import { WebCommand } from "./cmd/web"
import { PrCommand } from "./cmd/pr"
import { SessionCommand } from "./cmd/session"
import { DbCommand } from "./cmd/db"
import { errorMessage } from "../util/error"
import { PluginCommand } from "./cmd/plug"
import { Heap } from "./heap"
import { LicenseCommand, enforceLicenseGate } from "./cmd/license"
import { cliText } from "./text"
import { localizeCommand, localizeYargs } from "./yargs"

const args = hideBin(process.argv)

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("hypercode ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = localizeYargs(yargs(args))
  .parserConfiguration({ "populate--": true })
  .scriptName("hypercode")
  .wrap(100)
  .help("help", cliText("show help"))
  .alias("help", "h")
  .version("version", cliText("show version number"), InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: cliText("print logs to stderr"),
    type: "boolean",
  })
  .option("log-level", {
    describe: cliText("log level"),
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: cliText("run without external plugins"),
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    await enforceLicenseGate(args)

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
  })
  .usage("")
  .completion("completion", cliText("generate shell completion script"))
  .command(localizeCommand(AcpCommand))
  .command(localizeCommand(McpCommand))
  .command(localizeCommand(TuiThreadCommand))
  .command(localizeCommand(AttachCommand))
  .command(localizeCommand(RunCommand))
  .command(localizeCommand(GenerateCommand))
  .command(localizeCommand(DebugCommand))
  .command(localizeCommand(ConsoleCommand))
  .command(localizeCommand(ProvidersCommand))
  .command(localizeCommand(AgentCommand))
  .command(localizeCommand(UpgradeCommand))
  .command(localizeCommand(UninstallCommand))
  .command(localizeCommand(ServeCommand))
  .command(localizeCommand(WebCommand))
  .command(localizeCommand(ModelsCommand))
  .command(localizeCommand(StatsCommand))
  .command(localizeCommand(ExportCommand))
  .command(localizeCommand(ImportCommand))
  .command(localizeCommand(GithubCommand))
  .command(localizeCommand(PrCommand))
  .command(localizeCommand(SessionCommand))
  .command(localizeCommand(PluginCommand))
  .command(localizeCommand(DbCommand))
  .command(localizeCommand(LicenseCommand))
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      show(out)
    })
  } else {
    await cli.parse()
  }
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
