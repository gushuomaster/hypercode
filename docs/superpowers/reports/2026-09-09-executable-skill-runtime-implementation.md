# Executable Skill Runtime 实施报告

## 结论

本轮边界重构已经达到基线验收标准：视频复刻状态机、审批、QC、artifact 正式导入与交付规则由 `doubao-video-replica` skill 唯一拥有；HyperCode 仅提供可复用的 executable-skill 运行时、通用 actions、provider 路由、临时 artifact 和恢复日志。

真实 provider 的多分段并发、双模型 QC 和付费兜底尚未执行，以免在架构验收中产生外部费用；真实 skill 的完整交付协议已使用确定性本地 action 替身跑通。

## HyperCode 变更

- 增加 executable manifest 发现、受保护文件指纹、信任确认和按指纹隔离的 Python 环境。
- Python 环境根目录使用 `D:\venv`，不写入 C 盘 skill 安装目录或项目目录。
- 增加 `skill_execution`、`skill_operation` 与 `skill_artifact` 持久化结构及 migration。
- 增加严格单请求/单响应 JSON 进程协议、通用 `skill_run` 工具和 ready-action 调度器。
- 增加通用 capability router、LLM 多模态附件和通用图片生成入口。
- 增加受控 staging artifact store；skill 只能读取显式授权的 artifact。
- 删除 HyperCode 内原有视频复刻专用模块、工具与对应业务测试。

## Skill 契约修正

- host 不再提交视频业务字段 `segment_id`。
- skill 根据 pending action 的 `expected_segment_id` 自行绑定并校验正式导入目标。
- 当前指纹与环境详情见 `2026-09-04-doubao-video-replica-skill-fingerprints.md`。

## 验证结果

- HyperCode 相关测试：97 passed，1 skipped（真实 skill 测试默认 opt-in）。
- 真实 skill opt-in 纵向切片：1 passed。
- `packages/opencode`、`packages/app`、`packages/core` 的相关 `bun typecheck`：通过。
- core migration 测试：12 passed。
- app Question presentation 测试：4 passed。
- skill Python 全量测试：137 passed，2 skipped。
- `git diff --check`：通过，仅有工作区既存 LF/CRLF 提示。
- HyperCode 源码业务语义扫描：无视频阶段、审批函数、交付函数或 `project-state.json` 残留。

## 已知非阻塞项

- `packages/opencode/test/question/question.test.ts` 单独运行时存在 14 个既有 `InstanceRef not provided` 失败；本轮没有修改该实现或测试，相关 Question presentation 测试通过。
- `skill-creator` quick validator 依赖系统 Python 的 `yaml`，本机当前未安装；未为验证器额外改变系统环境。skill 自身全量测试及真实协议切片均已通过。
- SDK 状态中的生成文件变化来自 Windows 换行符检测；v2 生成文件已包含现有 `QuestionPresentation`，内容哈希与 `HEAD` 一致。本轮未修改公共 HTTP schema，未重跑生成器。
