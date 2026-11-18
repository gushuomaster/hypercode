# 全仓库通用约定

适用于仓库中所有包。权威来源是仓库根 `AGENTS.md`，本层只提炼写代码时最容易违反的规则，冲突时以原文为准。

## 文档索引

| 文档 | 内容 |
|---|---|
| [code-style.md](./code-style.md) | 控制流、函数组织、类型、导入与用户可见文案 |
| [testing-and-verification.md](./testing-and-verification.md) | 各包的测试与类型检查命令、写测试的原则、Product 契约修改后的验证步骤 |
| [git-and-repo-conventions.md](./git-and-repo-conventions.md) | 分支与提交规范、生成代码、依赖方向与 fork 约束 |

## 按改动位置查阅

| 改动位置 | 还需阅读 |
|---|---|
| `packages/product`，或任何两端都会呈现的行为 | `../product/index.md` |
| `packages/tui` | `../tui/index.md` |
| `sdks/vscode` | `../vscode/index.md` |
| `packages/opencode`、`packages/core` | `../opencode-core/index.md` |
| 跨层数据流、重复代码 | `../guides/index.md` |

## 其他权威来源

- `openspec/specs/`：已生效的产品与流程规范（`product-ownership`、`product-default-policy`、`cross-host-product-contract`）。
- `docs/规范/上游同步工作流总纲.md`：upstream 同步与合入流程。
- `docs/规范/上游同步与品牌化规范.md`：品牌化差异与 fork tax 维护。
