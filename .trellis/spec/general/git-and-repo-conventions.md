# Git 与仓库约定

权威来源是仓库根 `AGENTS.md`。

## 分支与提交

- 默认分支是 `dev`。本地可能没有 `main`，对比差异用 `dev` 或 `origin/dev`。
- 分支名最多三个词，用连字符分隔，不用斜杠，也不用 `feat/`、`fix/` 之类前缀。例如 `session-recovery`、`fix-scroll-state`。
- 提交信息和 PR 标题用 `type(scope): summary`。type 取 `feat`、`fix`、`docs`、`chore`、`refactor`、`test`；scope 可选，用受影响的包或区域，例如 `core`、`opencode`、`tui`、`sdk`。例如 `fix(tui): simplify thinking toggle styling`。
- 避免无关的行尾规范化造成大范围 diff。

## 生成代码与依赖方向

- 重新生成旧版 JavaScript SDK：运行 `./packages/sdk/js/script/build.ts`。
- 修改公共 Protocol 或 Server 的 `HttpApi` 后，在 `packages/client` 运行 `bun run generate`。不要直接编辑 `src/generated` 或 `src/generated-effect`。
- 运行时依赖方向：Schema 到 Core 与 Protocol，再到 Server。Client 运行时代码可以依赖 Schema 和 Protocol，但不能依赖 Core 或 Server。`sdk-next` 组合 Client、Core 和 Server。

## fork 约束

HyperCode 是持续维护的 OpenCode downstream fork。

- 优先采用满足需求的最小完整修改，避免不必要地扩大 fork tax，让未来的 upstream 同步保持可维护。
- 涉及 upstream 同步、同步验证和正式合入，遵循 `docs/规范/上游同步工作流总纲.md`。
- 涉及品牌化差异、fork tax 与 upstream 差异维护，遵循 `docs/规范/上游同步与品牌化规范.md`。
- 继承自 upstream 的 `AGENTS.md` 正文保持英文原文，不翻译、不重排，以减少同步冲突；HyperCode 本地新增的约定用中文。

## 常见错误

- 分支名带斜杠或类型前缀。
- 直接修改 `src/generated` 下的文件，而不是重新生成。
- 让 Client 运行时代码依赖 Core 或 Server。
