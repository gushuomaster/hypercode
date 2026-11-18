# Product 层

适用于 `packages/product`，以及所有同时影响 TUI 与 VSCode 的产品行为。这一层是 HyperCode 跨宿主一致性的核心约束：共享行为先在 Product 定义并测试，再由两个 Host 适配。

权威来源：

- `openspec/specs/product-ownership/spec.md`：Product 的所有权与 Host 边界
- `openspec/specs/cross-host-product-contract/spec.md`：命令目录与能力状态的跨宿主契约
- `openspec/specs/product-default-policy/spec.md`：用户可感知能力的默认值分类

## 文档索引

| 文档 | 内容 |
|---|---|
| [ownership-and-command-catalog.md](./ownership-and-command-catalog.md) | 所有权规则、包结构、命令目录写法、可用性事实推导、新增共享命令的步骤 |
| [host-adapters.md](./host-adapters.md) | Host 职责、adapter 写法、所有权边界测试、对等测试与已知取舍 |

## 运行与验证

在 `packages/product` 目录下：

- 测试：`bun test`
- 类型检查：`bun typecheck`

修改 Product 契约后，还要跑 TUI 与 VSCode 的相关测试、三个包的类型检查和 VSCode 打包，见 `../general/testing-and-verification.md`。

## 产品默认值

用户可感知能力的省略值必须经过 HyperCode Product Default Policy 判断，不能自动继承 upstream 语义。默认值分为 `default_on_lazy`、`default_on_passive`、`environment_managed`、`explicit_opt_in`、`explicit_unsupported`。能力启用要与联网下载、外部披露、付费和破坏性授权分开审查。例如会话分享涉及外部披露，属于 `explicit_opt_in`。
