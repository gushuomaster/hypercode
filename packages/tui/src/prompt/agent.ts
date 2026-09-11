import { displayCharAt, promptOffsetWidth } from "./display"

export function prepareAgentMention(input: string, name: string, start: number, end: number) {
  const before = start > 0 ? displayCharAt(input, start - 1) : undefined
  const after = displayCharAt(input, end)
  const prefix = before && !/\s/.test(before) ? " " : ""
  const suffix = after && /\s/.test(after) ? "" : " "
  const value = `@${name}`
  const sourceStart = start + promptOffsetWidth(prefix)

  return {
    text: prefix + value + suffix,
    source: {
      start: sourceStart,
      end: sourceStart + promptOffsetWidth(value),
      value,
    },
  }
}
