# C-002 Fresh-Home Preflight Validation

## Gate

`C002_READY_WITH_GUARDRAILS`

本报告只记录只读代码检查与运行验证；C-002 production code、manifest、`bun.lock` 和 Frozen Area 均未修改。

## 基线与隔离

- Worktree：`D:\project\hypercode\.worktrees\opencode-1.18.30-sync`
- `C002_PRECHECK_HEAD`：`17dacc3651518c01a45605f5d5855d3288e69811`
- 包含已接受提交：`f13c32d54`、`17dacc365`
- Bun：`1.3.14 (0d9b296a)`
- 验证日期：2026-09-14
- 每个 CLI 场景均使用独立临时目录作为 `HOME`、`USERPROFILE`、`TEMP`、`TMP` 及 `XDG_CONFIG_HOME`、`XDG_DATA_HOME`、`XDG_STATE_HOME`、`XDG_CACHE_HOME`；工作目录为临时空项目。
- 设置 `OPENCODE_PURE=1`、`OPENCODE_DISABLE_AUTOUPDATE=1`、`OPENCODE_DISABLE_AUTOCOMPACT=1`、`OPENCODE_DISABLE_MODELS_FETCH=1`、`OPENCODE_DB=:memory:`。生产 fresh 场景不设置 `OPENCODE_TEST_HOME`，以验证真实默认 bundled bootstrap；测试 suite 的 preload 使用其自身临时 `OPENCODE_TEST_HOME`。
- 临时 HOME 初始不包含 HyperCode/OpenCode config、auth、provider state 或 cache；场景结束后临时目录已删除。真实用户 HOME、AppData 和项目文件未写入。

## Behavior Matrix

| Scenario | Input / environment | Expected behavior | Actual behavior | Result / evidence |
|---|---|---|---|---|
| A. Completely Fresh | 空临时 HOME；无 `OPENCODE_TEST_HOME`；`debug info --pure` | 首次启动可完成，按 bundled 规则建立默认 global config | exit `0`；生成 `xdg-config/opencode/opencode.json`，内容等于 `bundledHypercodeConfig`；生成日志目录/日志文件，不生成 auth、provider state 或 credentials | PASS；CLI smoke 与文件快照 |
| B. HyperCode current path | global `hypercode.json`，`model=hypercode/model` | 加载 HyperCode 当前入口，不覆盖已有文件 | `debug config` 返回 `model=hypercode/model`、`username=hc`；未生成 `opencode.json` | PASS；CLI resolved-config 输出 |
| C. Legacy compatibility | global TOML `config`，provider/model/username 最小输入 | legacy 输入仍可读取并完成迁移 | `debug config` 返回 `legacy-provider/legacy-model`；写入 `config.json`（含 schema），删除 legacy `config` | PASS；CLI 输出与目录快照 |
| D. Global precedence | 同时提供 `config.json`、`opencode.json`、`opencode.jsonc`、`hypercode.json`、`hypercode.jsonc`，model 各不相同 | 后加载来源覆盖先加载来源 | 最终为 `hypercodec/model`；实际顺序为 `config.json → opencode.json → opencode.jsonc → hypercode.json → hypercode.jsonc` | PASS；CLI resolved-config 输出 |
| E. Project/local precedence | global `global`、项目 `opencode.json=project`、`.opencode/opencode.json=dot-opencode`、`.opencode/hypercode.json=dot-hypercode` | local/project 配置覆盖 global | 最终为 `dot-hypercode/model` | PASS；CLI resolved-config 输出 |

## Side Effects

- 预期目录：`xdg-config/opencode`、`xdg-data/opencode/log`、`xdg-data/opencode/repos`、`xdg-state/opencode`、`xdg-cache/opencode/bin`。
- 预期文件：fresh 场景的 `opencode.json` bundled config，以及运行日志 `opencode.log`。
- legacy 场景额外写入迁移后的 `config.json` 并删除 `config`，这是现有兼容契约。
- 未发现 auth、credentials、provider state 或项目 tracked/untracked 文件被写入。
- `Global.Path.tmp` 取 `os.tmpdir()`；验证时同步设置 `TEMP/TMP`，因此不会落入真实用户临时目录。仓库外已有的 `Temp\opencode\parse_manifest.py` 未修改。

## Validation Commands

- `bun test test/config/config.test.ts`（`packages/opencode`）：`118 pass / 0 fail`。
- `bun typecheck`（`packages/opencode`）：仅既有 F-013（`NpmTest.noop` 的 `Option<never>` 与 `Npm.Service.which` 返回类型不匹配），无 C-002 新错误。
- `bun run build`（`packages/app`）：成功；仅现有 Vite chunk/dynamic-import warnings。
- CLI smoke：`bun run packages/opencode/src/index.ts debug paths|info --pure|config --pure`，各场景 exit `0`。
- 代码路径审计：`Global.Path` 使用 `xdg-basedir`（导入时读取 `XDG_*`）；C-002 bootstrap 位于 `packages/opencode/src/config/config.ts` 与 `src/config/hypercode-bundled.ts`。

## Required Answers

1. Fresh HOME 默认行为：首次实际加载 global config 时生成 bundled `opencode.json`，并加载默认 HyperCode MiniMax 配置。
2. 兼容行为：legacy `config` 可复现并迁移为 `config.json`；`hypercode.json/jsonc`、`opencode.json/jsonc`、`config.json` 均可加载。
3. Runtime consumers：Config service 被 session、provider、plugin、MCP、LSP、tool、server handlers、CLI 等多处依赖；直接 `get/getGlobal` CLI consumer 至少包括 `debug config/info`、`mcp`、`network`、`upgrade`。
4. 不是历史静态死代码：fresh bootstrap、legacy migration 和 precedence 均由真实 CLI 运行触发。
5. Precedence：global 文件按 `config → opencode.json → opencode.jsonc → hypercode.json → hypercode.jsonc` 合并；随后项目文件与 `.opencode/.hypercode` local 目录覆盖 global；`OPENCODE_CONFIG_CONTENT` 位于 local 合并路径。
6. OpenCode 1.18.30 已覆盖通用 config loader、V2 compatibility 和 schema 解析，但未覆盖 HyperCode bundled 默认内容、HyperCode 文件名兼容和 legacy `config` 迁移保护条件。
7. 瘦身必须保持：bundled 首次启动条件、所有文件名兼容、legacy provider/model 转换与迁移副作用、global/local precedence、`OPENCODE_*` 路由及 schema/变量替换。
8. 未完全覆盖的 runtime：真实远程 well-known config、账号托管配置、插件依赖安装和真实 provider API 未在本 preflight 运行；现有 config suite 对这些路径有 fixture 覆盖。
9. 修改后证明方式：保留本报告的 CLI matrix 作为 pre/post characterization，运行 config suite、fresh-home smoke、app build、OpenCode typecheck，并比较既有 F-013 失败签名。
10. Phase 5A 适配性：适合，但只能以 `READY_WITH_GUARDRAILS` 进入 implementation batch；不得删除 schema、legacy 字段/文件名或迁移分支。

## Gate Rationale

Fresh-home baseline 可重复，HyperCode current path、legacy compatibility、global/local precedence 和副作用均有真实 CLI 证据，且 config suite 全绿。因此不阻塞 C-002。由于 Config service 是高影响面共享服务、legacy migration 会产生写入/删除副作用，且远程/托管 runtime 未在本轮真实网络运行，保留 guardrails 后再实施最小 extraction/deduplication；本轮不建立 `PENDING IMPLEMENTATION` 状态。

## Guardrails for Future Batch

- 只允许 bootstrap wrapper extraction/deduplication；保持 bundled 内容及所有 schema/legacy/filename 兼容。
- 先记录 pre-change matrix，再改动；只触及 C-002 allowlist 文件。
- targeted config suite、fresh-home matrix、app build、OpenCode typecheck 任一出现新失败即停止并回退独立提交。
- 不修改 manifest、`bun.lock`、global schema、Frozen Area 或真实用户 HOME。
