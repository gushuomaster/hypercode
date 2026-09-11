# Task 2 报告：图片生成 Adapter 与安全落盘

## 状态

已完成。Task 2 变更已提交，提交哈希：`ff910d2dbd563b96d07370bd1ae1f52869550509`。

## 设计选择

- `schema.ts` 定义稳定的 `ImageGeneration.Request`、`ImageGeneration.Result` 和 provider 类型。
- `provider.ts` 实现 NVIDIA OpenAI-compatible `/images/edits`（最多发送一张参考图）和 OpenAI-compatible `/images/generations`；凭据读取顺序为 `Auth.Service` 后 provider 环境变量。凭据、请求头和图片字节不进入错误、日志、状态或工具输出。
- `service.ts` 按 `modelPool` 顺序尝试，每个模型最多一次技术重试；输出目录、参考图和目标文件均通过真实路径约束，临时文件使用 `wx` 写入并在同目录 `rename` 原子落盘。
- `path.ts` 拒绝 `..` 越界、Windows 盘符切换和符号链接逃逸；生成文件名由 segment ID 清洗后追加时间戳和 UUID，避免覆盖参考图。
- `image_generate` 返回本地 `file://` attachment 元数据与非敏感生成元数据，不返回原始响应或凭据。

## 变更文件

- `packages/opencode/src/image-generation/schema.ts`
- `packages/opencode/src/image-generation/provider.ts`
- `packages/opencode/src/image-generation/service.ts`
- `packages/opencode/src/image-generation/path.ts`
- `packages/opencode/src/tool/image-generate.ts`
- `packages/opencode/src/tool/registry.ts`
- `packages/opencode/test/image-generation/service.test.ts`
- `packages/opencode/test/image-generation/path.test.ts`
- `packages/opencode/test/tool/registry.test.ts`

## TDD 验证

### RED

命令（`packages/opencode`）：

```text
bun test test/image-generation/path.test.ts test/image-generation/service.test.ts
```

关键输出：两个测试文件分别报 `Cannot find module '../../src/image-generation/path'` 和 `Cannot find module '../../src/image-generation/provider'`，0 pass，2 fail。

### GREEN

命令：

```text
bun test test/image-generation test/tool/registry.test.ts
```

关键输出：`21 pass`、`0 fail`、`37 expect() calls`。

## 类型检查

命令：

```text
bun typecheck
```

本次新增 `src/image-generation/*`、`src/tool/image-generate.ts` 和 registry 改动无类型错误。全量命令仍被基线已有的 `test/session/prompt.test.ts` Layer 泛型错误、`test/session/snapshot-tool-race.test.ts` Layer 泛型错误阻断；当前工作区另有未实现 Task 3 的 `test/video-replica/model-pool.test.ts` 缺少 `src/video-replica/model-pool`。这些均未在本任务中修改。

## 自审与关注点

- 通过本地 `Bun.serve` 测试服务覆盖成功响应、HTTP 503 技术重试、Auth 优先于环境变量、原子写入、参考图不变、输出路径越界及 symlink 逃逸。
- 原子写入使用随机临时文件和 `rename`；`ensuring` 清理残留临时文件。
- provider 当前按响应 `b64_json` 解码并通过 PNG/JPEG/WEBP 魔数校验；未知格式会失败且不会持久化。
- 全量 typecheck 的上述基线/跨任务失败仍需控制器在后续任务中处理。

## Fix Round 1

### 状态

已处理审查 findings。修复提交：`ab4b1f10a208e7b4a273be0ed250fa97eed0eebf`。

### Provider 契约

- OpenAI adapter 独立使用 `/images/generations` 与 `/images/edits`。`gpt-image-1-mini` 请求不再发送不支持的 `response_format`，改为 `output_format: "png"`；生成和编辑测试分别断言 URL、JSON/FormData 字段。
- 仓库和任务材料没有可验证的 NVIDIA 图片 endpoint/schema 契约。NVIDIA candidate 现在返回非重试的 `NVIDIA image generation contract unavailable`，且测试确认不会发出任何 HTTP 请求。后续只有在提供已验证 endpoint/schema 配置后才能启用。

### 路径与落盘安全

- 服务启动时固定 `realpath(instance.directory)` 为唯一 project root；output directory 不再成为二次信任根。
- 网络请求前只读取第一张参考图，通过打开的文件句柄冻结 bytes，并比较句柄与当前路径的 `dev`/`ino`；本地路径或读取错误不会进入 provider retry。
- provider 返回后、写临时文件前以及原子发布前重新以稳定 project root 做 realpath/containment 检查。测试在请求期间把 output directory 替换为指向项目外的 junction，确认项目外没有落盘。
- 普通 POSIX `rename` 可覆盖竞态创建的目标，因此改用同目录临时文件 + `fs.link(temp, destination)` 原子 no-clobber 发布，再清理临时 inode。测试覆盖目标预存在与原子发布失败清理。
- 临时文件清理会重新以 project root 验证路径，并比较 `dev`/`ino` 后才删除；测试在写入后交换 output directory，确认 cleanup 不会跟随 junction 删除项目外同名文件。
- Windows 当前环境允许 directory junction，因此覆盖目录交换；普通文件 symlink 创建返回 `EPERM`，无法可靠覆盖 symlink 文件交换。替代测试在 provider 请求期间替换参考图内容，确认 provider 只收到请求前冻结的第一张 bytes；生产逻辑仍对文件句柄和路径 identity 做二次校验。

### 重试、计数与工具

- 仅网络异常、响应体读取中断、HTTP 408/429/5xx 可重试一次；HTTP 409 与本地输入读取错误不重试。
- `Result.attempts` 统计整个 model pool 的实际 provider 调用次数，包括不支持的 NVIDIA candidate 与后续 OpenAI retry。
- 新增 `image_generate` 真实执行测试，覆盖 local file attachment、非敏感 metadata 与可诊断错误传播。
- 移除 `import * as Tool` 和工具内 `Effect.orDie`；受工具定义契约限制，typed generation error 被原样转为 defect，消息保持可诊断且不含凭据、header、prompt 或图片 bytes。

### Fix Round 1 RED/GREEN

- RED：`bun test test/image-generation test/tool/image-generate.test.ts`，13 fail，缺失 provider-specific body、全局 attempts、TOCTOU 防护与测试注入点。
- GREEN：`bun test test/image-generation test/tool/image-generate.test.ts test/tool/registry.test.ts`，33 pass，0 fail。
- 相关图测试：`bun test --timeout 30000 test/session/snapshot-tool-race.test.ts`，1 pass；`bun test --timeout 30000 test/session/prompt.test.ts`，39 pass，14 skip，0 fail。

### Typecheck 证据

- 基线 `f36d74283cc4139a8c45f52cb345d3bcdc79dd74` 在 detached worktree、复用等价根/包依赖后直接运行 `tsgo --noEmit`：exit 0。
- 当前工作树运行 `bun typecheck`：Task 2 与 session registry 图无 TypeScript diagnostic；唯一错误为并行 Task 3 未跟踪草稿 `test/video-replica/model-pool.test.ts(89,7): Cannot find name 'discover'`。因此不声称当前全量 typecheck 通过，也未修改 Task 3 文件。

## Fix Round 3

- NVIDIA Qwen Image Edit 官方证据为 `https://docs.nvidia.com/nim/visual-genai/latest/api/qwen-image-edit.html` 与 `https://docs.nvidia.com/nim/visual-genai/latest/_static/_static/yaml/qwen-image-edit.openapi.yaml`。本任务采用其中的 OpenAI-compatible `POST /v1/images/edits`：请求字段包含 `prompt`、`image`、`model`、`n`、`response_format: b64_json` 和 `size`，响应必须包含整数 `created` 与 `data[0].b64_json`。同一文档中的 native `/v1/infer` 未启用，因为本任务已明确选择 OpenAI-compatible 契约。
- Qwen 自定义 NIM endpoint 仅接受 loopback（`localhost`、IPv4 loopback 或 IPv6 loopback）或 `nvidiaAllowedHosts` 显式 allowlist。未列入 allowlist 的 HTTPS 主机在 HTTP 请求前失败，避免 NVIDIA 凭据被转发；URL credentials、query、fragment 均被拒绝，路径只允许根路径或 `/v1`。
- NVIDIA hosted FLUX 固定使用 `https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev`。models.dev 别名 `black-forest-labs/flux_1-kontext-dev` 与官方 dotted slug `black-forest-labs/flux.1-kontext-dev` 都映射到该 endpoint；响应按 `artifacts[0].base64` 解码。
- 最终输出路径不再预创建。服务先在同一目录预留随机 `.tmp` 文件，provider 完成后通过 `fs.link` no-clobber 发布。若 provider 执行期间出现同名目标，则安全失败且不覆盖已有内容。新增回归覆盖 provider 期间的目标可见性与竞态、FLUX slug/host、Qwen schema、远程主机 allowlist 和 IPv6 loopback。
- cleanup 删除临时文件前重新验证 project/output 的 `realpath` 和 `dev`/`ino` identity；父目录被交换时放弃删除，不跟随 junction/symlink。Node 的 `fs.rm`/`fs.link` 仅提供路径 API，因此验证与单个系统调用之间仍有理论 TOCTOU 窗口。该窗口属于同机攻击者并发重命名受控目录的威胁边界；当前通过 identity 复核和安全失败降低风险，但不声称实现了 descriptor-relative 原子 unlink。

### Fix Round 3 验证

```text
bun test test/image-generation test/tool/image-generate.test.ts
33 pass, 0 fail

bun typecheck
exit 0 (packages/opencode)
```

## Fix Round 2

- 提交：`e1737030c`（`fix(opencode): harden image provider contracts`）。
- NVIDIA Qwen 使用官方 NIM OpenAI-compatible JSON contract：`/v1/images/edits`；NIM base URL 仅接受 Auth metadata 或显式可信配置，拒绝不安全远程明文 URL，不伪造 hosted Qwen endpoint。
- NVIDIA FLUX 使用 hosted JSON contract：`/v1/genai/black-forest-labs/flux.1-kontext-dev`，响应按 `artifacts[].base64` 解码并校验图片 magic。
- 输出目录与保留文件均执行 realpath + `dev`/`ino` identity 校验；目录或目标在 provider 请求窗口内交换时安全失败，cleanup 不跟随交换后的 junction/symlink。
- 工具错误统一为 `status:error` 结构化结果；仅允许固定配置指引文本，避免泄露错误、凭据、prompt 或图像字节。
- 来源：NVIDIA NIM Image Edit API（`https://docs.nvidia.com/nim/vision-language-models/latest/quickstart.html`，OpenAI-compatible `/v1/images/edits`）与 NVIDIA hosted API catalog（`https://build.nvidia.com/black-forest-labs/flux.1-kontext-dev`）。
- 验证：`bun test test/image-generation test/tool/image-generate.test.ts`（25 pass，0 fail）；`bun typecheck`（`packages/opencode`，pass）。
- 初次基线 worktree 缺失包级 dependencies 时产生 module-resolution 噪声，补齐包级依赖 junction 后重跑才作为有效证据；临时 worktree 已清理。依赖 junction 清理曾移除部分 `.bun` 目标，随后使用 `bun install --frozen-lockfile` 从锁文件恢复，未产生 tracked dependency 变更。
