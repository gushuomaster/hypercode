# V2 Session Core 约束

适用于 V2 Session 相关代码。来源：仓库根 `AGENTS.md` 的「V2 Session Core」一节，这里按主题重新整理，冲突时以原文为准。

## 提交与执行分离

- `SessionV2.prompt(...)` 先把一条持久化的 `session_input` 记录写入，再调度建议性的 `SessionExecution.wake(sessionID)`；传 `resume: false` 时只写入、不唤醒。
- 串行 runner 在安全边界把已写入的输入提升为可见的用户消息。
- 持久化的提示写入和模型执行必须保持分离，不要在写入路径里直接跑模型。

## Session ID 与重试

- 复用 Session ID 表示接管已有 Session。
- 复用 prompt message ID 时，只有 Session、prompt 和投递方式都一致才按精确重试处理，冲突的复用要失败。
- 历史上已投影的 prompt 在精确重试时，惰性合成已提升的 inbox 记录。

## SessionExecution 与定位

- `SessionExecution` 是进程全局的，以 Session ID 为键。本地实现持有进程内的 Session coordinator，只在一次 drain 开始时通过 `SessionStore` 与 `LocationServiceMap.get(session.location)` 发现位置。不要让任何 layer 接收 Session ID。
- V2 的中断针对该 Session 在本进程内活跃的所有权链，空闲或不存在时中断是空操作。
- `SessionRunner`、模型解析、工具注册表、权限和文件系统都是 Location 范围的。`Location.workspaceID` 省略表示隐式本地放置，显式的 workspace 身份保留给未来的放置语义。
- 在实现集群之前，本地 Session drain 保持为进程内。`SessionRunCoordinator` 会合并显式的同 Session resume、合并 prompt 唤醒，并允许不同 Session 并发运行。
- 建议性唤醒只处理符合条件的持久化 inbox 行。崩溃后的续跑恢复需要单独的显式设计才能重试 provider 工作。一次 drain 没有持久身份，也没有 transcript 边界。
- EventV2 重放的 owner claim 与集群化的 Session 执行所有权互相独立，不要混用。

## 模型调用

- 每个 provider 轮次只显式调用一次 `llm.stream(request)`，并在持久化续跑前重新加载已投影的历史。
- 不要绕道旧的 `SessionPrompt.loop(...)`，也不要把编排交给内存里的工具循环。

## 投递语义

- 默认是 steer：在当前 drain 仍需继续时，于下一个安全的 provider 轮次边界提升。
- 显式的 `queue` 输入保持待处理，直到 Session 本来要变空闲；在该边界只提升一条，再重新判断是否继续，然后才提升下一条。
- 提升任何新的用户输入都会重置所选 agent 的 provider 轮次额度；一批 steer 只重置一次。

## System Context

System Context 的代数、注册表和内置项放在 `src/system-context`。Context Source 的生产者跟随它们所观察的领域；Session History 的选择和 Context Epoch 的持久化归 Session 自己。

## 常见错误

- 在 `SessionV2.prompt(...)` 里同步等待模型执行。
- 让某个 layer 接收 Session ID，而不是由进程全局的 `SessionExecution` 按 Session ID 管理。
- 为了方便把编排委托给内存工具循环，或调用旧的 `SessionPrompt.loop(...)`。
- 把 EventV2 的重放 owner claim 当成 Session 执行所有权。
