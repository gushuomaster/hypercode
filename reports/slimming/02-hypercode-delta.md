# HyperCode Delta

比较范围：

```text
bf05e8a1224d6560f7a441f70d09e0c77e50e931
→
b192343c6302616d6639b7ae3b183f86cfe8fa41
```

## Summary

`git diff --shortstat`：

```text
431 files changed, 62593 insertions(+), 1389 deletions(-)
```

状态统计（`git diff --name-status -M`）：

| 状态 | 数量 |
| --- | ---: |
| Added | 282 |
| Modified | 144 |
| Deleted | 0 |
| Renamed | 0 |
| Copied | 0 |
| Type changed | 5 |

“修改 OpenCode 原生文件”有两种口径：

- 严格 `M` 状态：144。
- 所有基线中已存在且当前发生变化的路径：149（144 Modified + 5 Type changed）。

本报告关键面板采用第二种口径，同时保留严格状态值。

## Modified Upstream Files

共 149 个基线既有路径发生变化。集中区域：

- `packages/opencode/`：96 个变化路径，其中 57 个位于 `src`，26 个位于 `test`。
- `packages/tui/`：29 个变化路径。
- `packages/app/`：21 个变化路径。
- `packages/core/`：5 个变化路径。
- `sdks/vscode/` 的基线既有文件主要为 package/build 元数据；扩展产品源码大多属于新增。

5 个 type change：

```text
packages/app/src/custom-elements.d.ts
packages/enterprise/src/custom-elements.d.ts
sdks/vscode/images/button-dark.svg
sdks/vscode/images/button-light.svg
sdks/vscode/images/icon.png
```

## HyperCode-only Files

相对 merge base 新增 282 个文件。主要集中于：

- 增强版 VS Code 扩展源码、测试与资源。
- HyperCode 品牌、license、bundled config 与离线打包入口。
- TUI 中文化与 prompt 扩展。
- 项目同步、rebrand、设计、操作和阶段记录文档。
- 视频复刻、图像生成与 workflow 相关实现和测试。

## Deleted and Renamed Upstream Files

- 删除上游文件：0。
- rename：0。
- copy：0。

因此当前 HyperCode delta 不包含基于 Git rename detection 的删除或重命名。

## HyperCode-only Packages

按 package name 与目标 OpenCode 对照，确认 1 个 HyperCode-only package：

```text
hypercode  sdks/vscode/package.json
```

注意：`sdks/vscode` 在上游也存在，但上游仅有轻量 VS Code 扩展；HyperCode 将其扩展为独立产品 package，并将 package name 改为 `hypercode`。因此“package 名称独占”是 1，“整个目录从无到有”不是 1。

## HyperCode-only Modules

按可独立识别的功能域统计 7 个主要自定义 module group：

1. 增强版 VS Code workspace/session 产品层。
2. HyperCode 品牌与兼容入口。
3. License 与机器标识模块。
4. Bundled config 同步模块。
5. Offline package/build 模块。
6. 上游同步与 rebrand 工具链。
7. 视频复刻、图像生成与工作流编排能力。

该数字是“主要功能模块组”而非文件夹数量；细节见 `05-feature-inventory.md`。

## Fork Surface by Directory

| 目录 | 变化文件数 | 说明 |
| --- | ---: | --- |
| `sdks/vscode/src` | 218 | 最大新增产品面，含 panel、sidebar、bridge、core、tests |
| `packages/opencode/src` | 57 | Core runtime、session、provider、plugin、CLI、config |
| `packages/tui/src` | 27 | TUI、i18n、prompt、plugin UI |
| `packages/opencode/test` | 26 | Core/CLI/session/provider 配套测试 |
| `packages/app/src` | 19 | UI 与多语言文案 |
| `packages/opencode/script` | 11 | build、offline、license tooling |
| `sdks/vscode/images` | 10 | 扩展资源 |
| `docs/superpowers/specs` | 5 | 设计文档 |
| `packages/core/src` | 4 | Core/config/skill 相关修改 |
| `docs/superpowers/plans` | 4 | 实施计划记录 |

## Fork Surface by Category

分类按路径主职责互斥映射；approximate change size 为 numstat 新增行与删除行之和。

| Category | Files | Added | Modified | Deleted | Type changed | Approx. change size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PLUGIN | 150 | 135 | 12 | 0 | 3 | 32,956 |
| TEST | 118 | 95 | 23 | 0 | 0 | 17,089 |
| DOCS | 30 | 28 | 2 | 0 | 0 | 8,168 |
| TUI | 28 | 5 | 23 | 0 | 0 | 1,717 |
| CORE | 25 | 3 | 22 | 0 | 0 | 465 |
| UI | 22 | 0 | 21 | 0 | 1 | 152 |
| CLI | 20 | 1 | 19 | 0 | 0 | 285 |
| SCRIPT | 15 | 14 | 1 | 0 | 0 | 2,999 |
| SERVER | 9 | 0 | 9 | 0 | 0 | 47 |
| BUILD | 5 | 0 | 5 | 0 | 0 | 55 |
| OTHER | 3 | 1 | 1 | 0 | 1 | 19 |
| DEPENDENCY | 3 | 0 | 3 | 0 | 0 | 15 |
| PROVIDER | 2 | 0 | 2 | 0 | 0 | 9 |
| DESKTOP | 1 | 0 | 1 | 0 | 0 | 6 |

`PLUGIN` 包含 `sdks/vscode`，因此规模明显高于传统 plugin package。

语义路径可能跨越上述互斥分类，因此另提供非互斥补充口径：

| Semantic surface | Files |
| --- | ---: |
| AGENT | 0 |
| SKILL | 1 |
| COMMAND | 0 |
| PROMPT | 11 |
| CONFIG | 11 |
| PATCH | 0 |

例如 prompt 文件在互斥主分类中可能归入 TUI、CLI 或 PLUGIN；此补充表用于回答“是否触及该语义面”，不能与主分类直接求和。

## Top Areas

1. `sdks/vscode`：HyperCode 最大独占产品面，也是后续同步最需要保护的公开入口。
2. `packages/opencode`：自定义 runtime 与上游核心代码交织，冲突密度最高。
3. `packages/tui`：中文化、品牌和交互扩展集中。
4. 测试：新增和修改共 118 个文件，表明自定义能力存在较广验证面。
5. `docs` 与脚本：同步、品牌、构建交付和阶段记录形成独立维护面。
