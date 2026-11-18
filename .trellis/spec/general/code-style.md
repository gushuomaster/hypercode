# 代码风格

适用于所有包的 TypeScript 代码。权威来源是仓库根 `AGENTS.md` 的 Style Guide；本文只提炼写代码时最容易违反的规则，冲突时以 `AGENTS.md` 为准。

## 控制流与变量

- 避免 `else`，用早返回。
- 优先 `const`，用三元表达式或早返回代替重新赋值。
- 只用一次的值直接内联，减少变量数量。
- 优先 `flatMap`、`filter`、`map`；`filter` 使用 type guard 以保持下游类型推断。

## 函数组织

- 一个函数能完成的事不要拆开；只被调用一次的 helper 不要预先抽取，除非它隐藏了真正复杂的边界，或有清晰独立的名字。
- 分支较多时，让主函数读起来是正常路径，把校验和细节放到下方的小 helper（例如 `requireConfig`、`readMetadata`）。
- 纯同步的解析、校验、选项构建保持同步，不要返回 `Effect`。
- 解析不可信的 JSON 字符串用 `Schema.UnknownFromJsonString` 加 `Schema.decodeUnknownOption`，不要手写 `JSON.parse` 再包 `Effect.try`。
- 注释只写非显然的约束和意外行为，不写显而易见的赋值或控制流。

## 类型与错误

- 不用 `any`。
- 依赖类型推断，只在导出或确实提升可读性时写显式类型。
- 尽量不用 `try`/`catch`。
- 文件读写优先用 Bun API，例如 `Bun.file()`。

## 导入与解构

- 不起别名导入，不写 `import { a as b }`。
- 不用星号导入，不写 `import * as Foo`。需要命名空间值时，导入模块自己导出的命名空间，例如 `import { Project } from "@opencode-ai/core/project"`，再用 `Project.ID`。
- 只在部分路径用到的重模块用动态导入，在最窄作用域顶部解构；不要写 `(await import("./x")).y()` 这类链式写法；分支专用的导入留在分支内，保持懒加载。
- 避免不必要的解构，用点号保留上下文：写 `obj.a`，不写 `const { a } = obj`。

## Effect 与数据库

- 在 Effect generator 中，先把服务绑定到具名变量再调用方法，不写嵌套的 `yield* (yield* Foo.Service).bar()`。
- Drizzle 表字段用 snake_case，这样列名不必再写成字符串参数。
- 在 `src/config` 下新增配置模块时，沿用文件顶部的自引用导出，例如 `export * as ConfigAgent from "./agent"`。
- opencode 核心层的完整 Effect 规则见 `../opencode-core/index.md`。

## 用户可见文案

UI、CLI、TUI、命令帮助、工具描述、权限提示、状态与错误信息默认使用简体中文；命令名、代码标识符、协议字段、provider/model ID、路径保持原文。第三方英文错误保留原文以便诊断，并附中文解释。来源：`AGENTS.md`「语言与用户体验」。

## 常见错误

- 无关的行尾规范化会产生大范围 diff。判断文件行尾用 `git ls-files --eol`，不要用 `tr` 计数。
- 为了省事把 upstream 的英文文案直接暴露给用户，需要本地化的文案要走本地化流程。
