# 模块形态与 Effect 规则

来源：`packages/opencode/AGENTS.md`。更完整的模式和例子见 `packages/opencode/specs/effect/migration.md`。

## 模块形态

不要使用 `export namespace Foo { ... }`。它不是标准 ESM，会阻碍 tree-shaking，也会让 Node 原生 TypeScript 运行器无法运行。改用顶层平铺导出，并在文件底部自引用：

```ts
// src/foo/foo.ts
export interface Interface { ... }
export class Service extends Context.Service<Service, Interface>()("@opencode/Foo") {}
export const layer = Layer.effect(Service, ...)
export const defaultLayer = layer.pipe(...)

export * as Foo from "./foo"
```

- 使用方导入命名空间投影：`import { Foo } from "@/foo/foo"`，再用 `Foo.Service`、`Foo.layer`。
- 命名空间私有的 helper 保持为不导出的顶层声明，使用方访问不到，本文件内部可用。
- 模块是 `foo/index.ts` 时，自引用来源写 `"."`，不写 `"./index"`：`export * as Foo from "."`。
- 目录里有多个独立兄弟模块时（如 `src/session/`、`src/config/`），每个兄弟文件各自带自引用，不加 barrel `index.ts`，使用方直接导入具体文件，例如 `import { SessionRetry } from "@/session/retry"`。barrel 会迫使每次导入都加载所有兄弟，破坏 tree-shaking 并拖慢加载。
- 在 `src/config` 下新增配置模块，沿用文件顶部的自引用导出，例如 `export * as ConfigAgent from "./agent"`。

## Effect 基本写法

- 组合用 `Effect.gen(function* () { ... })`。
- 有名字、需要追踪的 effect 用 `Effect.fn("Domain.method")`，内部 helper 用 `Effect.fnUntraced`。两者都接受 pipeable 运算符作为额外参数，不要再多套一层 `.pipe()`。
- 基于回调的 API 用 `Effect.callback`。
- 用 `Effect.void`，不写 `Effect.succeed(undefined)` 或 `Effect.succeed(void 0)`。
- 需要 `Date` 时用 `DateTime.nowAsDate`，不写 `new Date(yield* Clock.currentTimeMillis)`。

## Schema 与错误

- 多字段数据用 `Schema.Class`，单值类型用 `Schema.brand` 的品牌 schema。
- 带类型的错误用 `Schema.TaggedErrorClass`。
- 类似 defect 的原因用 `Schema.Defect`，不用 `unknown`。
- 在 `Effect.gen` 或 `Effect.fn` 里，直接提前失败的分支写 `yield* new MyError(...)`，不写 `yield* Effect.fail(new MyError(...))`。

## Runtime 与 InstanceState

- 所有服务用 `src/effect/run-service.ts` 的 `makeRuntime`，它返回 `{ runPromise, runFork, runCallback }`，底层共享 `memoMap` 对 layer 去重。
- 按目录或按项目存在、需要随实例清理的状态用 `src/effect/instance-state.ts` 的 `InstanceState`，它是以目录为键的 `ScopedCache`。判断标准：两个打开的目录不该共用一份服务时，就需要 `InstanceState`。
- 直接在 `InstanceState.make` 闭包里做事，`ScopedCache` 已保证只运行一次，不要再加 fiber、`ensure()` 回调或 `started` 标志。
- 清理用闭包内的 `Effect.addFinalizer` 或 `Effect.acquireRelease`；后台流消费者用闭包内的 `Effect.forkScoped`，实例销毁时 fiber 会被中断。
- 要让服务的 `init()` 不阻塞，在调用 `init()` 的地方 fork `InstanceState.get(state)`（例如 `Effect.forkIn(scope)`），不要在 `InstanceState.make` 闭包里 fork，否则其他读取该状态的方法会看到不完整的状态。
- `src/project/bootstrap.ts` 已用 `Effect.forkDetach` 包住每个服务的 `init()`，生产中 `init()` 是即发即弃。`init()` 内部保持同步，并发由调用方控制。
- 在 `Effect.gen` 里先把服务绑定到具名变量再调方法，不写嵌套的 `yield* (yield* Foo.Service).bar()`。

## Effect v4 beta

`Effect.fork` 和 `Effect.forkDaemon` 不存在，用 `Effect.forkIn(scope)` 把 fiber fork 进指定 scope。

## 优先使用 Effect 服务

- 文件 I/O 用 `FileSystem.FileSystem`，不用裸 `fs/promises`。
- 子进程用 `ChildProcessSpawner.ChildProcessSpawner` 搭配 `ChildProcess.make(...)`，不写自定义进程封装。
- HTTP 用 `HttpClient.HttpClient`，不用裸 `fetch`。
- 已经在 Effect 代码里时，优先用 `Path.Path`、`Config`、`Clock`、`DateTime`。
- 后台循环或定时任务在 layer 定义里用 `Effect.repeat` 或 `Effect.schedule` 搭配 `Effect.forkScoped`。
- 多个并发调用方应共享同一次进行中的计算时，用 `Effect.cached`，不要手写 `Fiber | undefined` 或 `Promise | undefined`。

## 回调边界

原生或外部回调（`@parcel/watcher`、`node-pty`、原生 `fs.watch`、插件回调等）需要重新进入带实例或 workspace 上下文的 Effect 服务时，用 `EffectBridge`。普通 async 代码显式传递上下文，或留在 Effect fiber 内，不要加隐式的实例上下文 shim。

## 常见错误

- 写 `export namespace`，或在多兄弟目录里加 barrel。
- 在 `InstanceState.make` 闭包里 fork 来实现非阻塞 `init()`。
- 把只需单次计算的并发去重写成手工保存 `Fiber` 或 `Promise`。
- 把纯同步的校验或解析函数写成返回 `Effect`。
