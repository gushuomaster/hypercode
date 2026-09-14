# Phase 3 Post-Sync Review Queue

同步 merge：`0472ed06209bc24eb76508005b16737aa0d8638c`  
目标父提交：`193de13a88d62a6409c6d385831180f1def527dc`

以下项目不阻塞本次 merge，但应在后续 review/Phase 4 处理：

1. `packages/opencode/src/config/config.ts`：验证 bundled config 同步与 V2 compat 的优先级、环境变量绕过条件。
2. `packages/opencode/src/mcp/index.ts`：验证 `createClient(directory)` 的 roots 能力、品牌 client name 与 OAuth `commit()` 顺序。
3. `packages/opencode/src/session/processor.ts`：验证 summary assistant 双写和 provider thinking block drop 日志在真实流中表现。
4. `packages/opencode/src/plugin/xai.ts`：审查保留的 loopback CORS/PKCE/state 流程及 HTML 文案本地化。
5. `packages/tui/src/feature-plugins/system/diff-viewer.tsx`：补充 `Main branch` 中文 locale key，避免 upstream 英文回退。
6. `packages/opencode/test/tool/fixtures/models-api.json`：确认合并后的 HyperCode Zen fixture 与 upstream provider 模型清单来源一致。
7. `packages/opencode/test/cli/help/__snapshots__/help-snapshots.test.ts.snap`：安装依赖后重新生成快照，核对 `--mini`/`--replay` 与 HyperCode 命令名。
8. `sdks/vscode/package.json`：发布前确认版本号、扩展 ID 与 marketplace metadata 的兼容策略。

队列原则：只处理同步直接引入的行为回归，不在本阶段做架构重构或大规模删减。
