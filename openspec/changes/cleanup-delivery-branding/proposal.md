# Proposal

## Why

品牌化与交付文档有几处遗留，影响交付质量与维护者判断：

- `sdks/vscode/package.json` 的 `publisher` 仍是 upstream 的 `sst-dev`，扩展 ID 为 `sst-dev.hypercode`，在扩展列表与 `code --list-extensions` 中可见。
- 构建手册与 Ubuntu 离线指南中的产物名、示例命令仍写 `1.17.3`（`docs/操作手册/构建与交付规范.md` L102-103、L145、L160-161、L182-183；`docs/用户指南/Ubuntu20.04离线安装与配置.md` L19 起），当前版本为 1.18.30。
- `docs/操作手册/构建与交付规范.md` 的 `## 产物清单` 被后插入的 `## Cross-Host Packaged Smoke` 截断，成为空节。
- `rebrand:check`（`scripts/rebrand-opencode-to-hypercode.mjs --dry-run`）在瘦身线收尾时为 `BASELINE_BLOCKED`（blocked: `core-env-alias-missing`、`runtime-env-alias-missing`；planned: `packages/app/src/i18n/en.ts` 4 处；manual: `README.md`、`sdks/vscode/src/extension.ts`），之后无人处理，无法作为同步后的品牌回归门禁。
- 数据/缓存目录仍为 `opencode`（`packages/core/src/global.ts` `const app = "opencode"`），根目录 `install` 脚本仍指向 OpenCode 基础设施。

## What Changes

- 文档：把交付文档中的版本号改为当前版本或改用 `<version>` 占位并说明取值来源；恢复 `## 产物清单` 正文并把 `## Cross-Host Packaged Smoke` 移到正确位置。
- `rebrand:check`：逐项处理当前 dry-run 签名（修正审计规则或修正源文件），使其在当前 HEAD 上为 PASS 或签名明确为可接受的已知项，并记录基线。
- `publisher`：**需要决策**（见下方"待决策"），决策后执行。
- 数据目录与 `install` 脚本：**需要决策**，本 change 只记录结论，不改代码。

### 待决策

1. **是否修改 `publisher`**：修改会改变扩展 ID，已安装用户需先卸载旧扩展；扩展 `globalState`/`workspaceState` 按扩展 ID 存储，会丢失（`hypercode.*` 设置项不受影响）。交付方式为 VSIX 侧载，不涉及 Marketplace。建议值如 `hypercode`。
2. **数据目录是否迁移到 `hypercode`**：牵涉会话库、认证、配置等全部用户数据，需带回退读取；与 `docs/后续修改清单.md` #1（会话库按构建渠道分裂，决策 D2）强相关，建议在 D2 定案后一并设计，本 change 不实施。
3. **根目录 `install` 脚本**：属于 upstream 的在线安装脚本，不在 HyperCode 交付范围（交付只有离线包、exe、vsix）。建议保持 upstream 原样以降低 fork tax，并在构建手册中注明不使用。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无。本 change 只涉及文档、扩展元数据与品牌审计工具，不改变产品行为规范；`skip_specs: true`。）

## Impact

- `docs/操作手册/构建与交付规范.md`、`docs/用户指南/Ubuntu20.04离线安装与配置.md`
- `scripts/rebrand-opencode-to-hypercode.mjs` 及其规则，可能涉及 `packages/app/src/i18n/en.ts`、`README.md`、`sdks/vscode/src/extension.ts`
- 决策 1 通过后：`sdks/vscode/package.json`、`docs/用户指南/安装部署说明.md`（卸载旧扩展说明）、构建手册中的扩展 ID
