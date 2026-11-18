# TUI 文案本地化

适用于 `packages/tui/src` 下所有用户可见文案。总原则见仓库根 `AGENTS.md` 的「语言与用户体验」：默认简体中文，命令名、代码标识符、协议字段、provider 与 model ID、路径保持原文。

## 文案表

- `src/i18n/en.ts` 导出 `dict` 与 `Keys` 类型，`src/i18n/zh.ts` 导出同结构的 `dict`。两份必须成对维护：`dicts` 的类型要求中文表与英文表同结构，新增 key 只写一份会在类型检查时报错。
- 代码里用 `t(key, params?, locale?)` 取文案，`key` 的类型是 `Keys`，不要用裸字符串拼 key。
- 带参数的文案用 `params` 传入，不要在调用处拼接中英文片段。
- 不翻译的专有名词（`MCP`、`LSP`、`HyperCode`、`opencode`、`API key`、`Shell` 等）保持原文，`test/i18n/hardcoded-copy.test.ts` 里有允许列表。

## 语言选择

`normalizeLocale` 决定当前语言：

1. 显式传入的 `"en"` 或 `"zh"` 优先。
2. 否则依次看环境变量 `LANG`、`LC_ALL`、`LANGUAGE`，值以 `zh` 开头（不区分大小写）判为中文，其余判为英文。

`setLocale` 与 `getLocale` 管理当前语言，`LOCALES` 的顺序是 `zh` 在前。不要在组件里自己读环境变量判断语言。

## Product 文案

Product 只给语义 key（`ProductTextKey`），不给最终文案。TUI 在 `src/product/text-adapter.ts` 的 `textKeys` 表里把 Product key 映射到 TUI 自己的文案 key，再由 `t()` 渲染。

- Product 新增 `ProductTextKey` 后，必须在 `textKeys` 补映射，同时在 `en.ts` 与 `zh.ts` 补对应文案，否则类型检查失败。
- 不可用命令的原因（如"此会话尚未分享。"）也走这条路径，不要在 TUI 里另写一份文案。

## 命令描述与来源标签

定义在 `src/i18n/index.ts`：

- `localizedDescription(command, locale)`：优先取 `description_i18n[locale]`，没有就回退到原始 `description`。外部作者写的英文描述保持原样，不强行翻译。
- `commandSourceLabel(command, locale)`：`mcp` 显示 `MCP`，`skill` 显示 `Skill`，带 `description_i18n` 的命令显示"命令"，其余显示"自定义"。技术名词不翻译。
- 内置 agent 的显示名用 `agentDisplayName`：`build`、`plan`、`general`、`explore` 有本地化名称，自定义 agent 名保持原样。

参考测试：`test/i18n/command-description.test.ts`、`test/i18n/shared-ui-copy.test.ts`。

## 防英文回退测试

`test/i18n/hardcoded-copy.test.ts` 扫描一份固定的文件清单，用正则查找属性（如 `title="..."`）、对象字段（如 `description: "..."`）以及 `<text>`、`<span>` 内的字面英文，发现不在允许列表里的英文就失败。

- 新增对话框或页面文件后，把它加进该测试的 `files` 清单，否则不会被审计。
- 确实需要保留的英文专有名词加进 `allowed`，不要放宽正则。
- upstream 同步最容易带回英文文案，同步后先跑这个测试。

## 常见错误

- 只在 `en.ts` 加 key，漏了 `zh.ts`。
- 在 JSX 里直接写英文字面量，或用字符串拼接组合中英文。
- 新增组件文件却没有加入 `hardcoded-copy.test.ts` 的清单。
- 把第三方的英文错误或描述翻译或吞掉。保留原文用于诊断，并另附中文解释。
