# Task 3 报告：模型池筛选、冻结与故障转移

## 状态

已完成并提交模型目录筛选、健康探针、任务快照冻结、同池故障转移和显式池耗尽结果。

## 实现

- `model-pool.ts` 仅从 ModelsDev 目录读取，执行 provider allowlist、deprecated、零输入/输出成本和能力过滤。
- 编排模型要求 text 输入/输出及 `tool_call`；图片模型允许无 `tool_call`，但要求 text 输入和 image 输出。
- 支持确认/已知模型集合、用户模型/provider 排序，并以稳定 provider/model ID 作为最终排序键。
- `discover` 可选执行健康探针，仅将健康候选纳入快照；`freeze` 深拷贝候选并记录创建时间。
- `nextAfterFailure` 只在 orchestration 或 image 的同一池内切换；`exhausted` 返回明确结果，提示付费升级需确认。

## 验证

- `bun test test/video-replica/model-pool.test.ts`：5 pass，0 fail。
- `bun typecheck`（`packages/opencode`）：通过。

## 关注点

ModelsDev 当前 `status` schema 没有 `active` 字面量；实现按“非 deprecated 即可用（undefined 视为 active）”处理。健康探针为可选注入函数，未提供时默认健康。
