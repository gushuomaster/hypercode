import React from "react"
import MarkdownIt from "markdown-it"
import { renderMarkdownCodeWindow } from "./CodeBlock"
import { parseAnchorFileReference, parseFileReference, syncMarkdownFileRefs } from "./FileRefText"

const markdown = createMarkdown()
const copyTipTimers = new WeakMap<HTMLButtonElement, number>()

export function MarkdownBlock({ fileRefStatus, onOpenFile, onResolveFileRefs, content, className = "" }: { fileRefStatus: Map<string, boolean>; onOpenFile: (filePath: string, line?: number) => void; onResolveFileRefs: (refs: Array<{ key: string; filePath: string }>) => void; content: string; className?: string }) {
  const html = React.useMemo(() => markdown.render(content || ""), [content])
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const sync = () => syncMarkdownFileRefs(root, fileRefStatus, onResolveFileRefs)
    sync()
    window.addEventListener("oc-file-refs-updated", sync)
    return () => window.removeEventListener("oc-file-refs-updated", sync)
  }, [fileRefStatus, html, onResolveFileRefs])

  return <div ref={rootRef} className={`oc-markdown${className ? ` ${className}` : ""}`} dangerouslySetInnerHTML={{ __html: html }} onClick={(event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const link = target.closest("a")
    if (link instanceof HTMLAnchorElement) {
      const fileRef = parseAnchorFileReference(link.getAttribute("href") || "", link.textContent || "")
      if (fileRef && fileRefStatus.get(fileRef.key) !== false) {
        event.preventDefault()
        event.stopPropagation()
        onOpenFile(fileRef.filePath, fileRef.line)
      }
      return
    }
    const inlineCode = target.closest(".oc-inlineCode")
    if (inlineCode instanceof HTMLElement) {
      if (!event.metaKey && !event.ctrlKey) {
        return
      }
      const fileRef = parseFileReference(inlineCode.textContent || "")
      if (!fileRef || !fileRefStatus.get(fileRef.key)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      onOpenFile(fileRef.filePath, fileRef.line)
      return
    }
    const button = target.closest("[data-copy-code]")
    if (!(button instanceof HTMLButtonElement)) {
      return
    }
    const value = button.getAttribute("data-copy-code") || ""
    if (!value) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    button.blur()
    const timer = copyTipTimers.get(button)
    if (timer) {
      window.clearTimeout(timer)
    }
    button.setAttribute("data-copied", "true")
    copyTipTimers.set(button, window.setTimeout(() => {
      button.removeAttribute("data-copied")
      copyTipTimers.delete(button)
    }, 1200))
    void copyText(value)
  }} />
}

function createMarkdown() {
  const instance = new MarkdownIt({
    breaks: true,
    linkify: true,
    highlight(value: string, language: string) {
      return renderMarkdownCodeWindow(value, language)
    },
  })
  installTaskListSupport(instance)
  const linkDefault = instance.renderer.rules.link_open
  instance.renderer.rules.link_open = (...args: Parameters<NonNullable<typeof linkDefault>>) => {
    const [tokens, idx, options, env, self] = args
    const href = tokens[idx]?.attrGet("href") || ""
    if (!parseAnchorFileReference(href, linkLabel(tokens, idx))) {
      tokens[idx]?.attrSet("target", "_blank")
      tokens[idx]?.attrSet("rel", "noreferrer noopener")
    }
    return linkDefault ? linkDefault(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
  }
  const codeInlineDefault = instance.renderer.rules.code_inline
  instance.renderer.rules.code_inline = (...args: Parameters<NonNullable<typeof codeInlineDefault>>) => {
    const [tokens, idx, options, env, self] = args
    tokens[idx]?.attrSet("class", "oc-inlineCode")
    return codeInlineDefault ? codeInlineDefault(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
  }
  return instance
}

function installTaskListSupport(instance: MarkdownIt) {
  instance.core.ruler.after("inline", "oc-task-lists", (state) => {
    for (let index = 0; index < state.tokens.length; index += 1) {
      const inlineToken = state.tokens[index]
      if (inlineToken?.type !== "inline" || !inlineToken.children?.length) {
        continue
      }
      if (state.tokens[index - 1]?.type !== "paragraph_open" || state.tokens[index - 2]?.type !== "list_item_open") {
        continue
      }

      const marker = extractTaskListMarker(inlineToken)
      if (!marker) {
        continue
      }

      inlineToken.content = marker.remaining
      const paragraphToken = state.tokens[index - 1]
      const listItemToken = state.tokens[index - 2]
      appendClass(paragraphToken, "oc-taskListLabel")
      appendClass(listItemToken, "oc-taskListItem")
      listItemToken?.attrSet("data-checked", marker.checked ? "true" : "false")
      appendClass(closestListToken(state.tokens, index - 3), "oc-taskList")

      const checkboxToken = new state.Token("html_inline", "", 0)
      checkboxToken.content = `<input class="oc-taskListCheckbox" type="checkbox"${marker.checked ? " checked" : ""} disabled tabindex="-1" aria-hidden="true">`
      inlineToken.children.unshift(checkboxToken)
    }
  })
}

function extractTaskListMarker(token: { content: string; children?: Array<{ type: string; content: string }> | null }) {
  const firstChild = token.children?.[0]
  if (!firstChild || firstChild.type !== "text") {
    return null
  }
  const match = firstChild.content.match(/^\[( |x|X)\]\s+/)
  if (!match) {
    return null
  }

  const remaining = firstChild.content.slice(match[0].length)
  firstChild.content = remaining
  if (!remaining) {
    token.children?.shift()
  }

  return {
    checked: match[1]?.toLowerCase() === "x",
    remaining: token.content.slice(match[0].length),
  }
}

function closestListToken(tokens: Array<{ type: string; attrJoin: (name: string, value: string) => void }>, startIndex: number) {
  for (let index = startIndex; index >= 0; index -= 1) {
    const token = tokens[index]
    if (token?.type === "bullet_list_open" || token?.type === "ordered_list_open") {
      return token
    }
  }
  return null
}

function appendClass(token: { attrGet?: (name: string) => string | null; attrJoin?: (name: string, value: string) => void } | null | undefined, className: string) {
  const classValue = token?.attrGet?.("class") || ""
  if (classValue.split(/\s+/).includes(className)) {
    return
  }
  token?.attrJoin?.("class", className)
}

function linkLabel(tokens: Parameters<NonNullable<MarkdownIt["renderer"]["rules"]["link_open"]>>[0], idx: number) {
  let value = ""
  for (let i = idx + 1; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (!token || token.type === "link_close") {
      break
    }
    value += token.content || ""
  }
  return value
}

function copyText(value: string) {
  const clipboard = window.navigator?.clipboard
  if (clipboard?.writeText) {
    return clipboard.writeText(value)
  }
  const input = document.createElement("textarea")
  input.value = value
  input.className = "oc-copyScratchpad"
  input.setAttribute("readonly", "true")
  document.body.appendChild(input)
  input.select()
  document.execCommand("copy")
  document.body.removeChild(input)
  return Promise.resolve()
}
