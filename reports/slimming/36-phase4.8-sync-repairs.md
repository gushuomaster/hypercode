# Phase 4.8 Sync Repairs

## Repair R-001 — VS Code `ContentFilterError` union compatibility

- 文件：`sdks/vscode/src/core/sdk.ts`
- 根因：上游提交 `e2527db3c7` 在 SDK v2 `AssistantMessage.error` 中新增 `ContentFilterError`；HyperCode 本地 `MessageError` union 未同步该成员。
- 影响：`snapshot.ts` 两处和 `sidebar/focused.ts` 一处无法把 SDK v2 `Message` 传给本地 `SessionMessage`。
- 修改：新增与上游 schema 同形状的 `ContentFilterError`，并加入 `MessageError` union。
- 验证：`sdks/vscode bun run check-types` PASS；Core/TUI typecheck 同时 PASS。
- 风险：仅扩大可接受错误类型，不改变序列化、渲染或错误处理分支。

## 结论

本阶段只有 R-001 一个同步修复。没有修改依赖、manifest、`bun.lock`、build script、测试断言或业务流程；没有任何“为了通过 Gate”而做的修复。
