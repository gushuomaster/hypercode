# Feature Inventory

本清单只描述功能与证据，不提出删除、合并或重构决定。

| Feature | 类型 | 主要目录 | 入口 | HyperCode 自定义程度 | Upstream 重叠可能 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| HyperCode 品牌与兼容入口 | Core/CLI/Build | `packages/opencode`, root scripts | `brand.ts`, CLI build/bin, rebrand script | 高 | 高 | `LIKELY_STILL_REQUIRED` |
| 增强版 VS Code 扩展 | Plugin/UI | `sdks/vscode` | `src/extension.ts`, `package.json` | 很高 | 部分 | `HYPERCODE_CUSTOM` |
| Workspace Session Panel | Plugin/UI | `sdks/vscode/src/panel` | panel provider、webview `App.tsx` | 很高 | 部分 | `HYPERCODE_CUSTOM` |
| Sessions/Todo/Diff/Subagents views | Plugin/UI | `sdks/vscode/src/sidebar`, `package.json` | `hypercode.sessions`, `todo`, `diff`, `subagents` | 很高 | 部分 | `LIKELY_STILL_REQUIRED` |
| VS Code workspace runtime | Plugin/Server | `sdks/vscode/src/core`, `bridge` | server、workspace、SDK adapter | 很高 | 中 | `LIKELY_STILL_REQUIRED` |
| TUI 中文化与体验扩展 | TUI | `packages/tui/src` | app、language context、prompt components | 高 | 高 | `LIKELY_STILL_REQUIRED` |
| License 与 machine identity | Core/CLI/Plugin | `packages/opencode/src/license`, `sdks/vscode/src/license` | license command、validator | 高 | 低 | `UPSTREAM_STATUS_UNKNOWN` |
| Bundled config lifecycle | Config/Core | `packages/opencode/src/config` | `hypercode-bundled.ts`, config bootstrap | 高 | 高 | `LIKELY_STILL_REQUIRED` |
| Offline package delivery | Build/Script | `script/`, `packages/opencode/script` | offline Linux/Windows build scripts | 高 | 中 | `HYPERCODE_CUSTOM` |
| Provider/model compatibility patches | Provider/Plugin | `packages/opencode/src/provider`, `plugin` | provider registry、Codex/XAI adapters | 中 | 高 | `POSSIBLE_UPSTREAM_OVERLAP` |
| Video replica workflow | Other/Tool | `packages/opencode` 与 project skills | workflow entrypoints、image generation/service | 高 | 未知 | `UPSTREAM_STATUS_UNKNOWN` |
| Repo agents/skills/commands | Agent/Skill/Command | `.opencode` | Markdown definitions、plugins/tools | 高 | 低至中 | `HYPERCODE_CUSTOM` |
| Upstream sync/rebrand workflow | Script/Docs | `scripts/`, `docs/规范`, `docs/操作手册` | sync PowerShell、rebrand MJS | 高 | 低 | `LIKELY_STILL_REQUIRED` |

## Feature Details

### HyperCode 品牌与兼容入口

- Purpose：对外呈现 HyperCode，同时保留内部 `opencode` package/provider/env 兼容性。
- Location：根 `package.json`、`packages/opencode/src/brand.ts`、CLI/build scripts。
- Main entry points：`hypercode` bin、品牌常量、rebrand dry-run/write。
- Related packages：`opencode`、TUI、VS Code、Desktop。
- Likely upstream dependency：CLI build、installation、provider id 与 package metadata。
- Confidence：高。

### 增强版 VS Code 扩展

- Purpose：提供 workspace-native sessions、panel、sidebars、commands、settings 与 server lifecycle。
- Location：`sdks/vscode`。
- Main entry points：`src/extension.ts`、`src/panel/provider/index.ts`、`src/sidebar/provider.ts`。
- Related packages：`@opencode-ai/sdk`、HyperCode CLI/server。
- Likely upstream dependency：SDK/API、session event shape、CLI launch contract。
- Confidence：高。

### TUI 中文化与体验扩展

- Purpose：向中国用户提供中文 UI、prompt 与本地化交互。
- Location：`packages/tui/src/i18n`、language context、app/prompt components。
- Main entry points：`app.tsx`、`context/language.tsx`、`component/prompt/index.tsx`。
- Related packages：TUI、opencode session/provider。
- Likely upstream dependency：OpenTUI components、TUI plugin API、session model。
- Confidence：高。

### License 与 Machine Identity

- Purpose：license 生成、验证、命令入口与 Windows machine id fallback。
- Location：`packages/opencode/src/license`、`packages/opencode/script/license`、`sdks/vscode/src/license`。
- Main entry points：license CLI command、validator、machine ID reader。
- Related packages：opencode、VS Code。
- Likely upstream dependency：CLI startup 与 config paths。
- Confidence：高；产品是否仍要求该能力为 `UNKNOWN`，因为现有规范同时记录过“禁止恢复授权门禁”的边界。

### Bundled Config Lifecycle

- Purpose：首次安装或运行时同步内置配置，同时保护用户已有配置和敏感字段。
- Location：`packages/opencode/src/config/hypercode-bundled.ts` 及 config bootstrap。
- Main entry points：global config initialization/sync。
- Related packages：opencode Core/config。
- Likely upstream dependency：上游 config schema、paths、plugin loading。
- Confidence：高。

### Offline Package Delivery

- Purpose：生成 Linux/Windows 离线安装包与目标模型清单。
- Location：`script/build-offline-*.ts`、`packages/opencode/script/offline-*.ts`。
- Main entry points：根 `build:offline-linux`、`build:offline-windows`。
- Related packages：opencode build、release artifacts。
- Likely upstream dependency：build target、binary layout、dependency graph。
- Confidence：高。

### Provider/Model Compatibility

- Purpose：维护 HyperCode 所需 provider/model behavior 与 fallback。
- Location：`packages/opencode/src/provider`、`packages/opencode/src/plugin`。
- Main entry points：provider registry、Codex/XAI/DigitalOcean plugins。
- Related packages：opencode、LLM、plugin。
- Likely upstream dependency：极高；上游 provider SDK 和 routing 持续变化。
- Confidence：中；部分功能可能已被目标 OpenCode 覆盖，但尚未做语义级逐项验证。

### Video Replica Workflow

- Purpose：豆包视频复刻、图像生成、质量评审、模型确认、fallback 和 checkpoint orchestration。
- Location：近期 `video-replica`/image workflow commits 所触及的 opencode 与 project skill 区域。
- Main entry points：具体稳定公共入口需进一步建立调用图，当前为 `UNKNOWN`。
- Related packages：opencode session/tool/provider、skills。
- Likely upstream dependency：session execution、tool registry、provider/image services。
- Confidence：中。

### Agents, Skills and Commands

- Purpose：提供仓库级代理、技能、命令、prompt 与 plugin workflow。
- Location：`.opencode/agent`、`.opencode/skills`、`.opencode/command`、`.opencode/plugins`。
- Main entry points：`.opencode` discovery/config。
- Related packages：opencode agent/skill/plugin loaders。
- Likely upstream dependency：配置 schema、skill discovery、plugin lifecycle。
- Confidence：高。

## Preliminary Upstream Overlap

- `POSSIBLE_UPSTREAM_OVERLAP`：provider/model compatibility、部分 config/session/CLI 行为。目标上游已在相同文件和模块持续开发。
- `UPSTREAM_STATUS_UNKNOWN`：license 产品要求、video replica 的完整能力对照。
- `LIKELY_STILL_REQUIRED`：HyperCode 用户可见品牌、中文化、增强 VS Code 产品面、bundled config 保护、同步/rebrand 工具链。
- `HYPERCODE_CUSTOM`：增强 VS Code 实现主体、offline delivery、repo-specific agents/skills/commands。
