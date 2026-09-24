import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"
import { batch, createEffect, createMemo } from "solid-js"
import { useSync } from "./sync"
import { useEvent } from "./event"
import path from "path"
import { useTuiPaths } from "./runtime"
import { useArgs } from "./args"
import { useSDK } from "./sdk"
import { RGBA } from "@opentui/core"
import { readJson, writeJsonAtomic } from "../util/persistence"
import { useTheme } from "./theme"
import { useToast } from "../ui/toast"
import { useRoute } from "./route"
import { usePermission } from "./permission"
import { cycleProductAgentName, cycleProductModelVariantState, deriveComposerSelection, deriveProductSessionList, isValidModelRef, toggleProductFavoriteModel, updateProductRecentModels } from "@opencode-ai/product"
import { toProductAgents, toProductProviders } from "../product/model-adapter"
import { toTuiProductAction, toTuiProductSelection } from "../product/action-adapter"
import { toTuiProductSessionInput } from "../product/session-list-adapter"

export type LocalTheme = {
  secondary: RGBA
  accent: RGBA
  success: RGBA
  warning: RGBA
  primary: RGBA
  error: RGBA
  info: RGBA
}

export function parseModel(model: string) {
  const [providerID, ...rest] = model.split("/")
  return {
    providerID: providerID,
    modelID: rest.join("/"),
  }
}

export const { use: useLocal, provider: LocalProvider } = createSimpleContext({
  name: "Local",
  init: () => {
    const sync = useSync()
    const sdk = useSDK()
    const toast = useToast()
    const theme = useTheme().theme
    const route = useRoute()
    const paths = useTuiPaths()
    const args = useArgs()
    const event = useEvent()
    const permission = usePermission()

    function isModelValid(model: { providerID: string; modelID: string }) {
      const provider = sync.data.provider.find((item) => item.id === model.providerID)
      return !!provider?.models[model.modelID]
    }

    function createAgent() {
      const agents = createMemo(() => sync.data.agent.filter((agent) => agent.mode !== "subagent" && !agent.hidden))
      const visibleAgents = createMemo(() => sync.data.agent.filter((agent) => !agent.hidden))
      const [agentStore, setAgentStore] = createStore({
        current: undefined as string | undefined,
      })
      const colors = createMemo(() => [
        theme.secondary,
        theme.accent,
        theme.success,
        theme.warning,
        theme.primary,
        theme.error,
        theme.info,
      ])
      return {
        list() {
          return agents()
        },
        visible() {
          return visibleAgents()
        },
        current() {
          return agents().find((x) => x.name === agentStore.current) ?? agents().at(0)
        },
        set(name: string) {
          const action = toTuiProductSelection({ type: "agent.select", agent: name })
          if (!action || action.type !== "agent.select") return
          if (!agents().some((x) => x.name === action.agent))
            return toast.show({
              variant: "warning",
              message: `Agent not found: ${action.agent}`,
              duration: 3000,
            })
          setAgentStore("current", action.agent)
        },
        move(direction: 1 | -1) {
          const next = cycleProductAgentName(toProductAgents(sync.data.agent), this.current()?.name, direction)
          if (next) this.set(next)
        },
        color(name: string) {
          const index = visibleAgents().findIndex((x) => x.name === name)
          if (index === -1) return colors()[0]
          const agent = visibleAgents()[index]

          if (agent?.color) {
            const color = agent.color
            if (color.startsWith("#")) return RGBA.fromHex(color)
            // already validated by config, just satisfying TS here
            return theme[color as keyof typeof theme] as RGBA
          }
          return colors()[index % colors().length]
        },
      }
    }

    const agent = createAgent()

    function createModel() {
      const [modelStore, setModelStore] = createStore<{
        ready: boolean
        model: Record<
          string,
          {
            providerID: string
            modelID: string
          }
        >
        recent: {
          providerID: string
          modelID: string
        }[]
        favorite: {
          providerID: string
          modelID: string
        }[]
        variant: Record<string, string>
      }>({
        ready: false,
        model: {},
        recent: [],
        favorite: [],
        variant: {},
      })

      const filePath = path.join(paths.state, "model.json")
      const state = {
        pending: false,
      }

      function save() {
        if (!modelStore.ready) {
          state.pending = true
          return
        }
        state.pending = false
        void writeJsonAtomic(filePath, {
          recent: modelStore.recent,
          favorite: modelStore.favorite,
          variant: modelStore.variant,
        })
      }

      readJson<unknown>(filePath)
        .then((x) => {
          if (!x || typeof x !== "object") return
          const value = x as Record<string, unknown>
          if (Array.isArray(value.recent)) setModelStore("recent", value.recent)
          if (Array.isArray(value.favorite)) setModelStore("favorite", value.favorite)
          if (typeof value.variant === "object" && value.variant !== null)
            setModelStore("variant", value.variant as Record<string, string>)
        })
        .catch(() => {})
        .finally(() => {
          setModelStore("ready", true)
          if (state.pending) save()
        })

      const productProviders = createMemo(() => toProductProviders(sync.data.provider))
      const selection = createMemo(() => {
        const configuredModel = [args.model, sync.data.config.model]
          .filter((value): value is string => !!value)
          .map(parseModel)
          .find((model) => isValidModelRef(productProviders(), model))
        return deriveComposerSelection({
          providers: productProviders(),
          agents: toProductAgents(sync.data.agent),
          agentOverride: agent.current()?.name,
          configuredModel,
          providerDefaults: sync.data.provider_default,
          recentModels: modelStore.recent,
          modelOverrides: modelStore.model,
          modelVariants: modelStore.variant,
        })
      })
      const currentModel = createMemo(() => selection().model)

      return {
        current: currentModel,
        get ready() {
          return modelStore.ready
        },
        recent() {
          return modelStore.recent
        },
        favorite() {
          return modelStore.favorite
        },
        parsed: createMemo(() => {
          const value = currentModel()
          if (!value) {
            return {
              provider: "Connect a provider",
              model: "No provider selected",
              reasoning: false,
            }
          }
          const provider = sync.data.provider.find((item) => item.id === value.providerID)
          const info = provider?.models[value.modelID]
          return {
            provider: provider?.name ?? value.providerID,
            model: info?.name ?? value.modelID,
            reasoning: info?.capabilities?.reasoning ?? false,
          }
        }),
        cycle(direction: 1 | -1) {
          const current = currentModel()
          if (!current) return
          const recent = modelStore.recent
          const index = recent.findIndex((x) => x.providerID === current.providerID && x.modelID === current.modelID)
          if (index === -1) return
          let next = index + direction
          if (next < 0) next = recent.length - 1
          if (next >= recent.length) next = 0
          const val = recent[next]
          if (!val) return
          this.set(val)
        },
        cycleFavorite(direction: 1 | -1) {
          const favorites = modelStore.favorite.filter((item) => isModelValid(item))
          if (!favorites.length) {
            toast.show({
              variant: "info",
              message: "Add a favorite model to use this shortcut",
              duration: 3000,
            })
            return
          }
          const current = currentModel()
          let index = -1
          if (current) {
            index = favorites.findIndex((x) => x.providerID === current.providerID && x.modelID === current.modelID)
          }
          if (index === -1) {
            index = direction === 1 ? 0 : favorites.length - 1
          } else {
            index += direction
            if (index < 0) index = favorites.length - 1
            if (index >= favorites.length) index = 0
          }
          const next = favorites[index]
          if (!next) return
          this.set(next, { recent: true })
        },
        set(model: { providerID: string; modelID: string }, options?: { recent?: boolean }) {
          const action = toTuiProductSelection({ type: "model.select", model })
          if (!action || action.type !== "model.select") return
          batch(() => {
            if (!isModelValid(action.model)) {
              toast.show({
                message: `Model ${action.model.providerID}/${action.model.modelID} is not valid`,
                variant: "warning",
                duration: 3000,
              })
              return
            }
            const a = agent.current()
            if (!a) return
            setModelStore("model", a.name, action.model)
            if (options?.recent) {
              setModelStore("recent", updateProductRecentModels(modelStore.recent, action.model))
              save()
            }
          })
        },
        toggleFavorite(model: { providerID: string; modelID: string }) {
          batch(() => {
            if (!isModelValid(model)) {
              toast.show({
                message: `Model ${model.providerID}/${model.modelID} is not valid`,
                variant: "warning",
                duration: 3000,
              })
              return
            }
            setModelStore("favorite", toggleProductFavoriteModel(modelStore.favorite, model))
            save()
          })
        },
        variant: {
          selected() {
            const m = currentModel()
            if (!m) return undefined
            const key = `${m.providerID}/${m.modelID}`
            if (Object.hasOwn(modelStore.variant, key)) return modelStore.variant[key]
            return selection().variant
          },
          current() {
            const v = this.selected()
            if (!v) return undefined
            if (!this.list().includes(v)) return undefined
            return v
          },
          list() {
            const m = currentModel()
            if (!m) return []
            const provider = sync.data.provider.find((item) => item.id === m.providerID)
            const info = provider?.models[m.modelID]
            if (!info?.variants) return []
            return Object.keys(info.variants)
          },
          set(value: string | undefined) {
            const m = currentModel()
            if (!m) return
            const action = toTuiProductSelection({ type: "variant.select", model: m, variant: value })
            if (!action || action.type !== "variant.select") return
            const key = `${action.model.providerID}/${action.model.modelID}`
            setModelStore("variant", key, action.variant ?? "default")
            save()
          },
          cycle() {
            const current = currentModel()
            if (!current) return
            const next = cycleProductModelVariantState(productProviders(), current, this.current(), modelStore.variant)
            if (next === modelStore.variant) return
            setModelStore("variant", next)
            save()
          },
        },
      }
    }

    const model = createModel()

    function createSession() {
      const [sessionStore, setSessionStore] = createStore<{
        ready: boolean
        pinned: string[]
      }>({
        ready: false,
        pinned: [],
      })

      const filePath = path.join(paths.state, "session.json")
      const state = {
        pending: false,
      }

      function save() {
        if (!sessionStore.ready) {
          state.pending = true
          return
        }
        state.pending = false
        void writeJsonAtomic(filePath, {
          pinned: sessionStore.pinned,
        })
      }

      readJson<unknown>(filePath)
        .then((x) => {
          if (!x || typeof x !== "object") return
          const pinned = (x as Record<string, unknown>).pinned
          if (Array.isArray(pinned))
            setSessionStore(
              "pinned",
              pinned.filter((item): item is string => typeof item === "string"),
            )
        })
        .catch(() => {})
        .finally(() => {
          setSessionStore("ready", true)
          if (state.pending) save()
        })

      const productSessions = createMemo(() => deriveProductSessionList({
          sessions: sync.data.session.map((item) => toTuiProductSessionInput(item)),
        }))
      const slots = createMemo(() => {
        const existing = new Set(productSessions().items.map((item) => item.id))
        return sessionStore.pinned.filter((id) => existing.has(id)).slice(0, 9)
      })

      function prune(sessionID: string) {
        batch(() => {
          if (sessionStore.pinned.includes(sessionID)) {
            setSessionStore(
              "pinned",
              sessionStore.pinned.filter((x) => x !== sessionID),
            )
          }
          save()
        })
      }

      event.on("session.deleted", (evt) => {
        prune(evt.properties.info.id)
      })

      return {
        get ready() {
          return sessionStore.ready
        },
        pinned() {
          return sessionStore.pinned
        },
        slots,
        isPinned(sessionID: string) {
          return sessionStore.pinned.includes(sessionID)
        },
        togglePin(sessionID: string) {
          batch(() => {
            const exists = sessionStore.pinned.includes(sessionID)
            const next = exists
              ? sessionStore.pinned.filter((x) => x !== sessionID)
              : [...sessionStore.pinned, sessionID]
            setSessionStore("pinned", next)
            save()
          })
        },
        quickSwitch(slot: number) {
          const target = slots()[slot - 1]
          if (!target) return
          const action = toTuiProductAction(
            { type: "session.switch", sessionID: target },
            {
              sessionID: route.data.type === "session" ? route.data.sessionID : "",
              sessions: productSessions().items,
            },
          )
          if (action.kind !== "session.switch") return
          route.navigate({ type: "session", sessionID: action.input.sessionID })
        },
      }
    }

    const session = createSession()

    const mcp = {
      isEnabled(name: string) {
        return sync.data.mcp_product.some((state) => state.name === name && state.availability === "connected")
      },
      async run(action: Extract<import("@opencode-ai/product").ProductAction, { type: `mcp.${string}` }>) {
        const target = toTuiProductAction(action, { sessionID: "" })
        if (target.kind !== "mcp") return
        if (target.action.type === "mcp.disconnect") {
          await sdk.client.mcp.disconnect({ name: target.action.name })
          return
        }
        if (target.action.type === "mcp.connect" || target.action.type === "mcp.reconnect") {
          await sdk.client.mcp.connect({ name: target.action.name })
        }
      },
    }

    createEffect(() => {
      const value = agent.current()
      if (!value?.model) return
      if (isModelValid(value.model)) return
      toast.show({
        variant: "warning",
        message: `Agent ${value.name}'s configured model ${value.model.providerID}/${value.model.modelID} is not valid`,
        duration: 3000,
      })
    })

    const result = {
      model,
      agent,
      mcp,
      session,
      permission,
    }
    return result
  },
})
