import { describe, expect, test } from "bun:test"
import path from "node:path"
import ts from "typescript"

const sourceRoot = path.resolve(import.meta.dir, "..")
const visibleAttributes = new Set(["aria-label", "data-tooltip", "placeholder", "title"])
const messageCalls = new Set(["showInformationMessage", "showWarningMessage", "showErrorMessage", "showInputBox", "showQuickPick"])
const visibleTechnicalText = new Set(["HyperCode", "MCP", "LSP", "SKILL", "URL", "WebFetch"])

describe("visible copy localization guard", () => {
  test("keeps Chinese product copy in dictionaries", async () => {
    const failures = await scan((node, file) => {
      if (!isTextLiteral(node) || !/[\u3400-\u9fff]/.test(node.text)) return
      return `${file}:${lineOf(node)} ${JSON.stringify(node.text)}`
    })

    expect(failures).toEqual([])
  })

  test("keeps direct JSX and VS Code message copy in dictionaries", async () => {
    const failures = await scan((node, file) => {
      if (ts.isJsxText(node)) {
        const value = node.text.trim()
        if (isProductCopy(value)) return `${file}:${lineOf(node)} ${JSON.stringify(value)}`
      }

      if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer)) {
        if (isProductCopy(node.initializer.text)) return `${file}:${lineOf(node)} ${node.name.getText()}=${JSON.stringify(node.initializer.text)}`
      }

      if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText()) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const value = directVisibleCopy(node.initializer.expression)
        if (value) return `${file}:${lineOf(node)} ${node.name.getText()}=${JSON.stringify(value)}`
      }

      if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && node.expression) {
        const value = directVisibleCopy(node.expression)
        if (value) return `${file}:${lineOf(node)} ${JSON.stringify(value)}`
      }

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && messageCalls.has(node.expression.name.text)) {
        const first = node.arguments[0]
        if (first && isDirectCopy(first)) return `${file}:${lineOf(node)} ${node.expression.name.text}(${first.getText()})`
      }
    })

    expect(failures).toEqual([])
  })
})

async function scan(check: (node: ts.Node, file: string) => string | undefined) {
  const failures: string[] = []
  const glob = new Bun.Glob("**/*.{ts,tsx}")
  for await (const relative of glob.scan({ cwd: sourceRoot })) {
    const normalized = relative.replace(/\\/g, "/")
    if (normalized.startsWith("test/") || normalized.includes(".test.") || normalized.startsWith("i18n/")) continue
    const text = await Bun.file(path.join(sourceRoot, relative)).text()
    const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, relative.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      const failure = check(node, relative)
      if (failure) failures.push(failure)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return failures
}

function isTextLiteral(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

function isDirectCopy(node: ts.Expression) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)
}

function isProductCopy(value: string) {
  const text = value.trim()
  return !!text
    && /[A-Za-z\u3400-\u9fff]/.test(text)
    && !visibleTechnicalText.has(text)
    && !/(?:lsp_diagnostics|filePath=|severity=)/.test(text)
}

function directVisibleCopy(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return isProductCopy(node.text) ? node.text : undefined
  }
  if (ts.isTemplateExpression(node)) {
    const text = node.head.text + node.templateSpans.map((span) => span.literal.text).join("")
    return isProductCopy(text) ? text : undefined
  }
  if (ts.isConditionalExpression(node)) {
    return directVisibleCopy(node.whenTrue) ?? directVisibleCopy(node.whenFalse)
  }
}

function lineOf(node: ts.Node) {
  return node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1
}
