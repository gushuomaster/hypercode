# HyperCode Skill Catalog Alignment Design

## 目标

把当前按发现结果平铺的 Skill 列表改为面向用户的确定性目录。TUI 和 VSCode 共享 Skill 来源分类、同名生效规则、分组优先级和组内排序；Host 只提供 workspace/home 边界、执行选择并渲染各自界面。

## 当前问题

- `app.skills` 返回 `name / description / location / content`，没有显式 scope。
- legacy Skill loader 并发写入按名称索引的对象，同名 Skill 的最终胜者可能受读取完成顺序影响。
- TUI 将返回数组原样放入单一 `Skill` 分类，未搜索时没有稳定名称排序。
- VSCode 将 Skill command 与 catalog fallback 合并为一个 autocomplete 列表，也没有共享来源投影。
- 用户无法判断某个 Skill 来自当前项目、全局安装、内置能力还是工作区之外。

## Canonical 契约

`packages/product` 新增纯 TypeScript Skill catalog projection：

```ts
type ProductSkillScope = "project" | "global" | "builtin" | "external"

type ProductSkillInput = {
  name: string
  description?: string
  location?: string
}

type ProductSkillCatalogInput = {
  skills: ProductSkillInput[]
  workspaceRoots: string[]
  home?: string
}
```

输出项保留 `name / description / location`，增加 `scope`、`textKey` 和 `overrides`。Product 负责：

1. 规范化 Windows/POSIX 路径并使用目录边界匹配，不做字符串前缀误判。
2. `location === "<built-in>"` 分类为 `builtin`。
3. 位于任一 workspace root 内分类为 `project`。
4. 位于 home 内分类为 `global`。
5. URL、缺失位置或其他位置分类为 `external`。
6. 同名 Skill 按 `project > global > external > builtin` 选择生效项。
7. 分组按 `project > global > builtin > external`，组内按名称稳定排序。
8. 被覆盖来源记录在 `overrides`，Host 不自行选择另一个同名项。

## Core 发现与覆盖

不修改 Protocol、Server `HttpApi` 或 generated client。legacy Skill discovery 在内部为发现项保留确定性优先级，加载改为顺序执行：内置最低，工作区外磁盘项其次，home 范围项再次，workspace 范围项最高；同一 scope 按规范化 location 排序后，后加载项覆盖前项。

Core 的职责仅是确保执行时真正生效的同名 Skill 与产品规则一致。来源标签、显示顺序和中文语义仍由 Product 决定。

## Host 展示

TUI：

- `DialogSkill` 使用 Product catalog，不再把所有项标记为同一个 `Skill` 分类。
- 分类显示为“项目 Skills / 全局 Skills / 内置 Skills / 外部 Skills”。
- 描述保持现有行为；location 不在默认列表暴露。
- 搜索继续跨所有分组，结果仍携带来源分类。

VSCode：

- extension host 加载 catalog 后立即通过 Product 投影并持久化 scope。
- dedicated Skill picker 按 Product 顺序生成条目，条目显示本地化来源；搜索仍跨组。
- command 与 catalog 同名时使用 catalog 的 canonical scope；缺少 catalog location 的纯 command 归为 `external`，不由 webview 猜路径。

## 兼容与边界

- 保持 `app.skills` 数据格式不变。
- Skill tool、prompt 注入、权限和内容加载不改变。
- 不显示被覆盖的同名 Skill 为可选项，避免用户选择一个实际不会执行的版本。
- 完整 location 继续用于 VSCode 打开文件和调试，不作为普通列表主信息。
- 对无法证明是项目或全局的来源明确标记 `external`，不伪造来源。

## 验证

- Product fixtures 覆盖 Windows/POSIX 边界、四类来源、排序、同名覆盖和 overrides。
- Core 测试覆盖项目同名 Skill 稳定覆盖全局 Skill。
- TUI 测试覆盖本地化分类与 Product 顺序。
- VSCode 测试覆盖 catalog scope 持久化和 dedicated picker 来源展示。
- 执行 Product/TUI/VSCode typecheck、相关测试、VSCode package、Windows validation build。

