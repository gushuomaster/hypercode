import type { Argv, CommandModule } from "yargs"
import { getLocale } from "@opencode-ai/tui/i18n"
import { cliText } from "./text"

type Option = Record<string, unknown> & {
  describe?: string | false
  description?: string | false
}

function localizeOption(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const option = value as Option
  return {
    ...option,
    ...(typeof option.describe === "string" ? { describe: cliText(option.describe) } : {}),
    ...(typeof option.description === "string" ? { description: cliText(option.description) } : {}),
  }
}

function localizeBuilder<T>(argv: Argv<T>): Argv<T> {
  let proxy: Argv<T>
  proxy = new Proxy(argv, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (typeof value !== "function") return value
      if (property === "option" || property === "positional") {
        return (name: string, option: unknown) =>
          localizeBuilder(Reflect.apply(value, target, [name, localizeOption(option)]) as Argv<T>)
      }
      if (property === "options") {
        return (options: Record<string, unknown>) =>
          localizeBuilder(
            Reflect.apply(value, target, [Object.fromEntries(Object.entries(options).map(([name, option]) => [name, localizeOption(option)]))]) as Argv<T>,
          )
      }
      if (property === "command") {
        return (command: CommandModule, ...args: unknown[]) =>
          localizeBuilder(Reflect.apply(value, target, [localizeCommand(command), ...args]) as Argv<T>)
      }
      return (...args: unknown[]) => {
        const result = Reflect.apply(value, target, args)
        return result === target ? proxy : result
      }
    },
  })
  return proxy
}

export function localizeCommand<T, U>(input: CommandModule<T, U>): CommandModule<T, U> {
  const builder = input.builder
  return {
    ...input,
    ...(typeof input.describe === "string" ? { describe: cliText(input.describe) } : {}),
    ...(typeof builder === "function"
      ? {
          builder: (argv: Argv<T>) => Promise.resolve(builder(localizeBuilder(argv))).then((result) => localizeBuilder(result)),
        }
      : builder
        ? {
            builder: Object.fromEntries(
              Object.entries(builder).map(([name, option]) => [name, localizeOption(option)]),
            ),
          }
        : {}),
  } as CommandModule<T, U>
}

export function localizeYargs<T>(argv: Argv<T>) {
  if (getLocale() === "en") return argv
  argv.updateStrings({
    "Commands:": "命令：",
    "Positionals:": "位置参数：",
    "Options:": "选项：",
    "Examples:": "示例：",
    "Show help": "显示帮助",
    "Show version number": "显示版本号",
    "boolean": "布尔值",
    "count": "计数",
    "string": "字符串",
    "number": "数字",
    "array": "数组",
    "required": "必需",
    "default": "默认值",
    "choices": "可选值",
    "aliases": "别名",
  })
  return argv
}
