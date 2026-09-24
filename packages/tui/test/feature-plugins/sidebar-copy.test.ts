import { describe, expect, test } from "bun:test"
import { sidebarContextUsageText } from "../../src/feature-plugins/sidebar/context"
import { deriveSidebarLspEmptyState } from "../../src/feature-plugins/sidebar/lsp"
import { t } from "../../src/i18n"
import { deriveSidebarHeader } from "../../src/routes/session/sidebar"

describe("session sidebar product copy", () => {
  test("keeps the internal session id out of the visible header", () => {
    const session = {
      id: "ses_internal_identifier",
      title: "打招呼",
      workspaceID: "workspace-a",
      share: { url: "https://example.test/share" },
    }

    expect(deriveSidebarHeader(session)).toEqual({
      title: "打招呼",
      workspaceID: "workspace-a",
      shareURL: "https://example.test/share",
    })
  })

  test("does not present an unknown context limit as zero percent used", () => {
    expect(sidebarContextUsageText({ availability: "unknown" })).toEqual({ textKey: "sidebar.context.limitUnknown" })
    expect(sidebarContextUsageText({ availability: "known", percent: 0 })).toEqual({
      textKey: "sidebar.context.used",
      params: { percent: 0 },
    })
  })

  test("derives localized empty LSP states", () => {
    expect(deriveSidebarLspEmptyState(false)).toBe("sidebar.lsp.lazy")
    expect(deriveSidebarLspEmptyState(true)).toBe("sidebar.lsp.disabled")
  })

  test("localizes context and lazy LSP status for Chinese users", () => {
    expect(t("sidebar.context.title", undefined, "zh")).toBe("上下文")
    expect(t("sidebar.context.tokens", { count: "18,196" }, "zh")).toBe("已使用 18,196 tokens")
    expect(t("sidebar.context.limitUnknown", undefined, "zh")).toBe("上下文上限未知")
    expect(t("sidebar.context.spent", { cost: "$0.00" }, "zh")).toBe("本会话费用 $0.00")
    expect(t("sidebar.lsp.lazy", undefined, "zh")).toBe("处理匹配文件时自动启动")
    expect(t("sidebar.lsp.disabled", undefined, "zh")).toBe("LSP 已禁用")
  })
})
