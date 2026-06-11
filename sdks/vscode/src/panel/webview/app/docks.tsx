import React from "react"
import type { PermissionRequest, QuestionInfo, QuestionRequest, SessionStatus } from "../../../core/sdk"
import type { AppState, FormState } from "./state"

type FileRefTextComponent = ({ value, display, tone }: { value: string; display?: string; tone?: "default" | "muted" }) => React.JSX.Element

type PermissionLine =
  | {
      type: "text"
      text: string
    }
  | {
      type: "path"
      prefix?: string
      path: string
      display?: string
      tone?: "default" | "muted"
    }

export function PermissionDock(props: {
  request: PermissionRequest
  currentSessionID: string
  rejectMessage: string
  onRejectMessage: (value: string) => void
  onReply: (reply: "once" | "always" | "reject", message?: string) => void
  FileRefText: FileRefTextComponent
}) {
  const { request, currentSessionID, rejectMessage, onRejectMessage, onReply, FileRefText } = props
  const childRequest = request.sessionID !== currentSessionID
  const info = permissionInfo(request)
  return (
    <section className="oc-dock oc-dock-warning">
      <div className="oc-dockHeader">
        <span className="oc-kicker">权限</span>
        <span className="oc-dockTitle">{info.label || "需要审批"}</span>
      </div>
      <div className="oc-dockText">{info.intro || "HyperCode 等待确认后再继续。"}</div>
      <div className="oc-inlineValue">{renderPermissionLine(info.title, FileRefText)}</div>
      {info.details.length > 0 ? (
        <div className="oc-detailList">
          {info.details.map((item) => <div key={permissionLineKey(item)} className="oc-dockText">{renderPermissionLine(item, FileRefText)}</div>)}
        </div>
      ) : null}
      {request.patterns?.length ? (
        <div className="oc-detailList">
          <div className="oc-patternRow">
            {info.patternTitle ? <div className="oc-help">{info.patternTitle}</div> : null}
            {request.patterns.map((item) => <span key={item} className="oc-pill">{item}</span>)}
          </div>
        </div>
      ) : null}
      {childRequest ? (
        <textarea
          className="oc-answerInput"
          value={rejectMessage}
          onChange={(event) => {
            const value = event.currentTarget.value
            onRejectMessage(value)
          }}
          placeholder="拒绝时给子会话的可选指令"
        />
      ) : null}
      <div className="oc-actionRow">
        <button type="button" className="oc-btn" onClick={() => onReply("reject", childRequest ? rejectMessage.trim() || undefined : undefined)}>拒绝</button>
        <button type="button" className="oc-btn" onClick={() => onReply("once")}>仅本次允许</button>
        <button type="button" className="oc-btn oc-btn-primary" onClick={() => onReply("always")}>始终允许</button>
      </div>
    </section>
  )
}

export function QuestionDock(props: {
  request: QuestionRequest
  form: FormState
  onOption: (index: number, label: string, multiple: boolean) => void
  onCustom: (index: number, value: string) => void
  onReject: () => void
  onSubmit: () => void
}) {
  const { request, form, onCustom, onOption, onReject, onSubmit } = props
  const meta = questionPromptInfo(request)
  const [tab, setTab] = React.useState(0)
  const total = request.questions.length
  const last = tab >= total - 1

  React.useEffect(() => {
    setTab(0)
  }, [request.id])

  const next = () => {
    if (last) {
      onSubmit()
      return
    }
    setTab((current) => Math.min(total - 1, current + 1))
  }

  const item = request.questions[tab]
  if (!item) {
    return null
  }

  return (
    <section className="oc-dock oc-dock-warning">
      <div className="oc-dockHeader">
        <span className="oc-kicker">问题</span>
        <span className="oc-dockTitle">{meta.title}</span>
      </div>
      <div className="oc-dockText">{meta.text}</div>
      <QuestionBlock
        request={request}
        mode="active"
        form={form}
        tab={tab}
        onTab={setTab}
        onOption={onOption}
        onCustom={onCustom}
      />
      <div className="oc-actionRow">
        <button type="button" className="oc-btn" onClick={onReject}>拒绝</button>
        <div className="oc-actionRow">
          {tab > 0 ? <button type="button" className="oc-btn" onClick={() => setTab((current) => Math.max(0, current - 1))}>上一题</button> : null}
          <button type="button" className="oc-btn oc-btn-primary" onClick={next}>{last ? "提交回答" : "下一题"}</button>
        </div>
      </div>
    </section>
  )
}

export function QuestionBlock(props: {
  request: Pick<QuestionRequest, "id" | "questions">
  mode: "active" | "answered"
  form?: FormState
  tab?: number
  onTab?: (index: number) => void
  onOption?: (index: number, label: string, multiple: boolean) => void
  onCustom?: (index: number, value: string) => void
  answers?: string[][]
}) {
  const { request, mode, form, tab = 0, onTab, onOption, onCustom, answers = [] } = props
  const items = mode === "active"
    ? request.questions.filter((_item, index) => index === tab)
    : request.questions

  return (
    <div className={`oc-question oc-question-${mode}`}>
      {mode === "active" && request.questions.length > 1 ? (
        <div className="oc-questionProgress" role="tablist" aria-label="问题进度">
          {request.questions.map((_item, index) => {
            const done = questionAnswers(request, index, form, answers).length > 0
            const active = index === tab
            return (
              <button
                key={`progress:${index}`}
                type="button"
                className={`oc-questionProgressItem${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                onClick={() => onTab?.(index)}
                aria-label={`第 ${index + 1} 题`}
              />
            )
          })}
        </div>
      ) : null}
      <div className="oc-questionList">
        {items.map((item) => {
          const index = request.questions.indexOf(item)
          const current = questionAnswers(request, index, form, answers)
          const known = new Set(item.options.map((option) => option.label))
          const customAnswers = current.filter((answer) => !known.has(answer))
          return (
            <QuestionItem
              key={answerKey(request.id, index)}
              index={index}
              item={item}
              mode={mode}
              selected={current}
              custom={form ? form.custom[answerKey(request.id, index)] ?? "" : customAnswers.join("\n")}
              onOption={onOption}
              onCustom={onCustom}
            />
          )
        })}
      </div>
    </div>
  )
}

function QuestionItem(props: {
  index: number
  item: QuestionInfo
  mode: "active" | "answered"
  selected: string[]
  custom: string
  onOption?: (index: number, label: string, multiple: boolean) => void
  onCustom?: (index: number, value: string) => void
}) {
  const { index, item, mode, selected, custom, onOption, onCustom } = props
  const multiple = !!item.multiple
  const answered = mode === "answered"
  const [expanded, setExpanded] = React.useState(() => !answered || selected.length === 0)
  const marker = (picked: boolean) => {
    if (multiple) {
      return picked ? "[x]" : "[ ]"
    }
    return picked ? "(*)" : "( )"
  }

  const known = new Set(item.options.map((option) => option.label))
  const customAnswers = selected.filter((answer) => !known.has(answer))
  const customValue = mode === "active" ? custom : customAnswers.join("\n")
  const customPicked = customAnswers.length > 0 || (mode === "active" && !!custom.trim())
  const showSummary = answered && selected.length > 0 && !expanded
  const selectedKey = selected.join("\n")

  React.useEffect(() => {
    setExpanded(!answered || selected.length === 0)
  }, [answered, selected.length, selectedKey])

  const summary = (
    <div className="oc-questionOptions">
      {item.options
        .filter((option) => selected.includes(option.label))
        .map((option) => (
          <div key={option.label} className="oc-questionOption is-selected">
            <span className="oc-questionMark" aria-hidden="true">{marker(true)}</span>
            <span className="oc-questionOptionBody">
              <span className="oc-questionOptionLabel">{option.label}</span>
              {option.description ? <span className="oc-questionOptionDescription">{option.description}</span> : null}
            </span>
          </div>
        ))}
      {item.custom === false ? null : customValue.trim() ? (
        <div className="oc-questionOption oc-questionOption-custom is-selected">
          <span className="oc-questionMark" aria-hidden="true">{marker(true)}</span>
          <span className="oc-questionOptionBody">
            <span className="oc-questionOptionLabel">自定义回答</span>
            <span className="oc-questionAnswerText">{customValue}</span>
          </span>
        </div>
      ) : null}
    </div>
  )

  const options = (
    <>
      <div className="oc-questionOptions">
        {item.options.map((option) => {
          const picked = selected.includes(option.label)
          const body = (
            <>
              <span className="oc-questionMark" aria-hidden="true">{marker(picked)}</span>
              <span className="oc-questionOptionBody">
                <span className="oc-questionOptionLabel">{option.label}</span>
                {option.description ? <span className="oc-questionOptionDescription">{option.description}</span> : null}
              </span>
            </>
          )
          if (answered) {
            return <div key={option.label} className={`oc-questionOption${picked ? " is-selected" : ""}`}>{body}</div>
          }
          return (
            <button
              key={option.label}
              type="button"
              className={`oc-questionOption${picked ? " is-selected" : ""}`}
              onClick={() => onOption?.(index, option.label, multiple)}
            >
              {body}
            </button>
          )
        })}
        {item.custom === false ? null : answered ? (
          customValue.trim() ? (
            <div className="oc-questionOption oc-questionOption-custom is-selected">
              <span className="oc-questionMark" aria-hidden="true">{marker(true)}</span>
              <span className="oc-questionOptionBody">
                <span className="oc-questionOptionLabel">自定义回答</span>
                <span className="oc-questionAnswerText">{customValue}</span>
              </span>
            </div>
          ) : null
        ) : (
          <label className={`oc-questionOption oc-questionOption-custom${customPicked ? " is-selected" : ""}`}>
            <span className="oc-questionMark" aria-hidden="true">{marker(customPicked)}</span>
            <span className="oc-questionOptionBody">
              <span className="oc-questionOptionLabel">输入你自己的回答</span>
              <textarea
                className="oc-answerInput oc-questionInput"
                value={custom}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  onCustom?.(index, value)
                }}
                placeholder="可选的自定义回答"
                rows={Math.max(2, custom.split("\n").length || 2)}
              />
            </span>
          </label>
        )}
      </div>
      {answered && selected.length === 0 ? <div className="oc-questionAnswerEmpty">未记录回答。</div> : null}
    </>
  )

  return (
    <section className="oc-questionCard">
      <div className="oc-questionItemHead">
        <div className="oc-inlineValue">{item.header || "问题"}</div>
        {answered ? (
          <div className="oc-questionItemHeadMeta">
            <span className="oc-questionState">{selected.length > 0 ? "已回答" : "未回答"}</span>
            {selected.length > 0 ? (
              <button
                type="button"
                className="oc-questionSummaryAction"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? "隐藏选项" : "显示选项"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="oc-questionPrompt">{item.question || ""}</div>
      {mode === "active" ? <div className="oc-questionHint">{multiple ? "可选择一个或多个回答。" : "请选择一个回答。"}</div> : null}
      {showSummary ? (
        <div className="oc-questionDetails">
          {summary}
        </div>
      ) : answered && selected.length > 0 ? (
        <div className="oc-questionDetails">{options}</div>
      ) : options}
    </section>
  )
}

export function RetryStatus({ status }: { status?: SessionStatus }) {
  const retry = status?.type === "retry" ? status : undefined
  const [seconds, setSeconds] = React.useState(() => retry?.next ? Math.max(0, Math.round((retry.next - Date.now()) / 1000)) : 0)

  React.useEffect(() => {
    if (!retry?.next) {
      setSeconds(0)
      return
    }

    const tick = () => setSeconds(Math.max(0, Math.round((retry.next - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [retry?.next])

  if (!retry) {
    return null
  }

  return (
    <section className="oc-dock oc-dock-error">
      <div className="oc-dockHeader">
        <span className="oc-kicker">重试</span>
        <span className="oc-dockTitle">第 {retry.attempt} 次尝试</span>
      </div>
      <div className="oc-dockText">{retry.message}</div>
      <div className="oc-help">{seconds > 0 ? `${formatDuration(seconds)} 后` : ""}重试第 {retry.attempt} 次</div>
    </section>
  )
}

export function SubagentNavigation(props: {
  navigation: AppState["snapshot"]["navigation"]
  onNavigate: (sessionID: string) => void
}) {
  const { navigation, onNavigate } = props
  if (!navigation.parent && !navigation.prev && !navigation.next) {
    return null
  }

  return (
    <nav className="oc-dock oc-subagentNavDock" aria-label="子代理导航">
      <div className="oc-subagentNavActions">
        {navigation.parent ? <button type="button" className="oc-btn" onClick={() => onNavigate(navigation.parent!.id)}>父级</button> : null}
        {navigation.prev ? <button type="button" className="oc-btn" onClick={() => onNavigate(navigation.prev!.id)}>上一个</button> : null}
        {navigation.next ? <button type="button" className="oc-btn" onClick={() => onNavigate(navigation.next!.id)}>下一个</button> : null}
      </div>
    </nav>
  )
}

export function SubagentFooter(props: {
  children?: React.ReactNode
}) {
  const { children } = props

  return (
    <section className="oc-dock oc-subagentDock">
      <div className="oc-subagentDockHeader" title="子会话隐藏输入框。">
        <span className="oc-kicker">子代理</span>
        <span className="oc-subagentReadonly">只读会话</span>
      </div>
      {children ? <div className="oc-subagentDockStatus">{children}</div> : null}
    </section>
  )
}

export function answerKey(requestID: string, index: number) {
  return `${requestID}:${index}`
}

type PermissionInfo = {
  label: string
  intro: string
  title: PermissionLine
  details: PermissionLine[]
  patternTitle?: string
}

function permissionInfo(request: PermissionRequest): PermissionInfo {
  const input = permissionInput(request)
  const details: PermissionLine[] = []
  const base = {
    label: "需要审批",
    intro: "HyperCode 等待确认后再继续。",
  }

  if (request.permission === "edit") {
    const filepath = stringValue(request.metadata?.filepath)
    if (filepath) {
      details.push({ type: "path", prefix: "路径：", path: filepath })
    }
    const diff = stringValue(request.metadata?.diff)
    if (diff) {
      details.push({ type: "text", text: diff })
    }
    return {
      ...base,
      title: filepath
        ? { type: "path", prefix: "编辑 ", path: filepath }
        : { type: "text", text: "编辑文件" },
      details,
    }
  }

  if (request.permission === "read") {
    const filePath = stringValue(input.filePath)
    return {
      ...base,
      title: filePath
        ? { type: "path", prefix: "读取 ", path: filePath }
        : { type: "text", text: "读取文件" },
      details: filePath ? [{ type: "path", prefix: "路径：", path: filePath }] : details,
    }
  }

  if (request.permission === "glob" || request.permission === "grep") {
    const pattern = stringValue(input.pattern)
    return {
      ...base,
      title: { type: "text", text: `${capitalize(request.permission)} ${pattern ? `"${pattern}"` : "请求"}` },
      details: pattern ? [{ type: "text", text: `匹配模式：${pattern}` }] : details,
    }
  }

  if (request.permission === "list") {
    const dir = stringValue(input.path)
    return {
      ...base,
      title: dir
        ? { type: "path", prefix: "列出 ", path: dir }
        : { type: "text", text: "列出目录" },
      details: dir ? [{ type: "path", prefix: "路径：", path: dir }] : details,
    }
  }

  if (request.permission === "bash") {
    const title = stringValue(input.description) || "Shell 命令"
    const command = stringValue(input.command)
    return {
      ...base,
      title: { type: "text", text: title },
      details: command ? [{ type: "text", text: `$ ${command}` }] : details,
    }
  }

  if (request.permission === "task") {
    const type = stringValue(input.subagent_type) || "未知"
    const description = stringValue(input.description)
    return {
      ...base,
      title: { type: "text", text: `${capitalize(type)} 任务` },
      details: description ? [{ type: "text", text: description }] : details,
    }
  }

  if (request.permission === "webfetch") {
    const url = stringValue(input.url)
    return {
      ...base,
      title: { type: "text", text: `WebFetch ${url || "请求"}` },
      details: url ? [{ type: "text", text: `URL：${url}` }] : details,
    }
  }

  if (request.permission === "websearch" || request.permission === "codesearch") {
    const query = stringValue(input.query)
    return {
      ...base,
      title: { type: "text", text: `${capitalize(request.permission)} ${query ? `"${query}"` : "请求"}` },
      details: query ? [{ type: "text", text: `查询：${query}` }] : details,
    }
  }

  if (request.permission === "external_directory") {
    const filepath = stringValue(request.metadata?.filepath)
    const parentDir = stringValue(request.metadata?.parentDir)
    const pattern = stringValue(request.patterns?.[0])
    const target = parentDir || filepath || pattern || "请求"
    return {
      label: "需要权限",
      intro: "HyperCode 想要访问当前工作区之外的位置后再继续。",
      title: { type: "text", text: `访问外部目录 ${target}` },
      details: parentDir && filepath && parentDir !== filepath ? [{ type: "path", prefix: "路径：", path: filepath }] : [],
      patternTitle: request.patterns?.length ? "匹配模式" : undefined,
    }
  }

  if (request.permission === "doom_loop") {
    return {
      label: "需要权限",
      intro: "HyperCode 因相同的故障反复出现而暂停。",
      title: { type: "text", text: "在反复失败后继续" },
      details: [{ type: "text", text: "这将允许会话在反复失败时继续运行。" }],
    }
  }

  return {
    ...base,
    title: { type: "text", text: `调用工具 ${request.permission || "permission"}` },
    details,
  }
}

function renderPermissionLine(line: PermissionLine, FileRefText: FileRefTextComponent) {
  if (line.type === "path") {
    return (
      <>
        {line.prefix || ""}
        <FileRefText value={line.path} display={line.display || line.path} tone={line.tone} />
      </>
    )
  }
  return line.text
}

function permissionLineKey(line: PermissionLine) {
  return line.type === "path"
    ? `${line.prefix || ""}${line.path}`
    : line.text
}

function permissionInput(request: PermissionRequest) {
  return request.metadata && typeof request.metadata === "object" ? request.metadata : {}
}

function questionPromptInfo(request: QuestionRequest) {
  const first = request.questions[0]
  if (request.questions.length === 1 && first && isPlanExitQuestion(first)) {
    return {
      title: "构建代理",
      text: "计划已就绪。请确认 HyperCode 是否切回构建模式开始实施。",
    }
  }
  return {
    title: "需要回答",
    text: "HyperCode 需要你的回答后才能继续。",
  }
}

function isPlanExitQuestion(question: QuestionInfo) {
  return question.header === "Build Agent"
    && question.custom === false
    && question.options.length === 2
    && question.options[0]?.label === "Yes"
    && question.options[1]?.label === "No"
    && question.question.includes("switch to the build agent")
}

function questionAnswers(request: Pick<QuestionRequest, "id" | "questions">, index: number, form?: FormState, answers: string[][] = []) {
  if (!form) {
    return answers[index] ?? []
  }
  const key = answerKey(request.id, index)
  const base = form.selected[key] ?? []
  const custom = (form.custom[key] ?? "").trim()
  return custom ? [...base, custom] : base
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

function capitalize(value: string) {
  if (!value) {
    return ""
  }
  return value[0].toUpperCase() + value.slice(1)
}

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) {
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (remainMinutes > 0) {
    return `${hours}h ${remainMinutes}m`
  }
  return `${hours}h`
}
