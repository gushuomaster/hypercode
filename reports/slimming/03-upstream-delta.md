# Upstream Delta

比较范围：

```text
bf05e8a1224d6560f7a441f70d09e0c77e50e931
→
193de13a88d62a6409c6d385831180f1def527dc
```

## Summary

```text
2537 files changed, 446648 insertions(+), 175580 deletions(-)
```

| 状态 | 数量 |
| --- | ---: |
| Added | 1,021 |
| Modified | 1,311 |
| Deleted | 124 |
| Renamed | 81 |

目标版本的 `packages/opencode/package.json` 为 `1.18.30`；目标 commit 没有 exact tag，tag 状态为 `UNKNOWN`。

## Major Package Changes

目标 OpenCode 相对当前 HyperCode 增加以下 package：

```text
@opencode-ai/client
@opencode-ai/codemode
@opencode-ai/httpapi-codegen
@opencode-ai/protocol
@opencode-ai/schema
@opencode-ai/sdk-next
@opencode-ai/session-ui
glm52-rise-video (artifact package)
```

这些新增 package 体现出 client/protocol/schema/codegen/session UI 的进一步拆分。

## Major Architecture Changes

- Core：429 个 `packages/core` 路径变化；数据库 schema、session、filesystem、public API 与 migrations 均有大规模演进。
- App/UI：`packages/app` 528 个、`packages/ui` 180 个变化路径；上游新增 `packages/session-ui` 并迁移大量 session component。
- OpenCode runtime：`packages/opencode` 406 个变化路径；CLI、session、provider、MCP、config 与 server adapter 均有变化。
- Server/Protocol：Server group/API 部分迁移到新 `packages/protocol`，并新增 schema/codegen package。
- Desktop/Web：`packages/desktop` 112 个、`packages/web` 74 个变化路径。
- TUI：65 个变化路径，涉及 app、prompt、plugins、routes 与 tests。

## Major File Movements

上游共检测到 81 个 rename。主要移动模式：

- `packages/ui/src/components/*` → `packages/session-ui/src/components/*`。
- `packages/ui/src/pierre/*` → `packages/session-ui/src/pierre/*`。
- `packages/server/src/groups/*` → `packages/protocol/src/groups/*`。
- `packages/opencode/src/server/cors.ts` → `packages/server/src/cors.ts`。
- `packages/opencode/src/session/prompt/max-steps.txt` → `packages/core/src/session/runner/max-steps.ts`。
- `packages/opencode/src/shell/shell.ts` → `packages/core/src/shell.ts`。
- Core migration snapshot 汇总到 `packages/core/schema.json`。

## Deleted Upstream Modules

上游删除 124 个路径。值得关注的模块级变化包括：

- 多批 `packages/core/migration/*` 独立 snapshot/migration 文件被替换或汇总。
- `packages/core/src/public/*` 多个旧 public API 文件被删除。
- `packages/server/src/groups/*` 多个 group 文件因 protocol 拆分被删除或迁移。
- `packages/ui/src/components/markdown*`、message/session component 因 session UI 拆分被删除或迁移。
- `packages/opencode/src/project/instance-layer.ts`、`pty-preparation.ts` 等旧入口被删除。
- 若 HyperCode 后续依赖这些旧 API/路径，需要在同步阶段逐项验证；本阶段不推断兼容结果。

## New Upstream Modules

- `packages/session-ui`：Session UI 组件和 Pierre diff/file runtime。
- `packages/protocol`：Server protocol groups 与公共错误结构。
- `packages/schema`：共享 schema。
- `packages/client`：Client 能力。
- `packages/codemode`：Codemode 运行能力。
- `packages/httpapi-codegen`：HTTP API code generation。
- `packages/sdk-next`：下一代 SDK。
- App v2、tab、prompt-input、workspace selector、settings-v2 与 visual-stability 测试设施。

## Fork Surface by Category

| Category | Files | Added | Modified | Deleted | Renamed | Approx. change size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| TEST | 661 | 304 | 337 | 16 | 4 | 277,776 |
| UI | 659 | 305 | 280 | 10 | 64 | 133,941 |
| CORE | 364 | 39 | 238 | 84 | 3 | 64,229 |
| OTHER | 356 | 226 | 120 | 1 | 9 | 110,558 |
| DESKTOP | 104 | 58 | 45 | 1 | 0 | 3,332 |
| WEB | 74 | 1 | 73 | 0 | 0 | 10,362 |
| SERVER | 53 | 6 | 40 | 6 | 1 | 2,434 |
| TUI | 51 | 6 | 45 | 0 | 0 | 3,243 |
| PLUGIN | 48 | 34 | 14 | 0 | 0 | 2,428 |
| CLI | 39 | 1 | 38 | 0 | 0 | 847 |
| PROVIDER | 27 | 2 | 25 | 0 | 0 | 2,942 |
| DEPENDENCY | 25 | 7 | 18 | 0 | 0 | 1,180 |
| PATCH | 16 | 12 | 1 | 3 | 0 | 3,424 |
| DOCS | 16 | 8 | 8 | 0 | 0 | 1,027 |

## Files Changed by Both HyperCode and OpenCode

精确同路径交集为 89 个文件。按区域统计：

| 区域 | 交集文件数 |
| --- | ---: |
| `packages/opencode/src` | 30 |
| `packages/app/src` | 18 |
| `packages/opencode/test` | 16 |
| `packages/tui/src` | 10 |
| `packages/core/src` | 2 |
| 其他单文件区域 | 13 |

交集中的关键生产文件包括：

```text
package.json
bun.lock
packages/core/src/config.ts
packages/opencode/src/cli/cmd/run/splash.ts
packages/opencode/src/config/config.ts
packages/opencode/src/ide/index.ts
packages/opencode/src/mcp/index.ts
packages/opencode/src/mcp/oauth-callback.ts
packages/opencode/src/plugin/digitalocean.ts
packages/opencode/src/plugin/openai/codex.ts
packages/opencode/src/plugin/xai.ts
packages/opencode/src/provider/provider.ts
packages/opencode/src/session/processor.ts
packages/opencode/src/session/retry.ts
packages/opencode/src/session/session.ts
packages/tui/src/app.tsx
packages/tui/src/component/prompt/autocomplete.tsx
packages/tui/src/component/prompt/index.tsx
sdks/vscode/package.json
```

此外，多语言文件、测试、workflow、package metadata、Storybook mock 和 VS Code 元数据也在交集中。完整冲突文件见 `04-conflict-map.md`。
