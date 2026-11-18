# opencode 核心层

适用于 `packages/opencode`，以及 `packages/core` 中的 Effect 与数据库代码。权威来源是 `packages/opencode/AGENTS.md` 和仓库根 `AGENTS.md`，本层只提炼写代码时最容易违反的规则，冲突时以原文为准。

## 文档索引

| 文档 | 内容 |
|---|---|
| [effect-and-modules.md](./effect-and-modules.md) | 模块形态（自引用导出）与 Effect 写法 |
| [session-core.md](./session-core.md) | V2 Session Core 的边界与不变量 |

## 数据库

- Drizzle schema 在 `packages/core/src/**/*.sql.ts`。
- 数据库 migration 在 `packages/core`，由 core 应用。
- 字段名用 snake_case，列名不必再写成字符串参数（见 `../general/code-style.md`）。

## 开发服务器

`packages/opencode` 下运行 `bun dev` 会启动交互式 TUI，不要作为前台阻塞命令运行。`AGENTS.md` 的做法是放进 `tmux`：`tmux new-session -d -s opencode-dev 'bun dev'`，用 `tmux capture-pane -pt opencode-dev` 读取输出，结束后 `tmux kill-session -t opencode-dev`。这套做法依赖 `tmux`，在原生 Windows 环境下先确认它可用，不可用时改用其他方式观察，不要前台阻塞。

## 与 Product 的边界

同时影响 TUI 与 VSCode 的产品行为归 `packages/product`，不要在 opencode 核心层替宿主决定排序、fallback 或可用性。参见 `../product/ownership-and-command-catalog.md`。

`packages/opencode` 中同时是 HyperCode 本地改动的路径（例如 `src/lsp/lsp.ts`、`src/skill/index.ts`、`src/command/index.ts`、`src/cli/cmd/run/*`）会增加 fork tax。改动前先确认是否真的需要落在这里。
