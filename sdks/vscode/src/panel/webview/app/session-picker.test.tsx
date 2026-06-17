import assert from "node:assert/strict"
import { describe, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { SessionInfo } from "../../../core/sdk"
import { buildSessionPickerView, scrollActiveSessionPickerItemIntoView, SessionPicker } from "./session-picker"

function session(id: string, updated: string, title = id, shareUrl?: string): SessionInfo {
  const time = new Date(updated).getTime()
  return {
    id,
    directory: "/workspace",
    title,
    time: {
      created: time,
      updated: time,
    },
    ...(shareUrl ? { share: { url: shareUrl } } : {}),
  }
}

describe("session picker view", () => {
  const now = new Date("2026-04-19T12:00:00Z").getTime()
  const sessions = [
    session("ses_current", "2026-04-19T11:00:00Z", "Current session"),
    session("ses_today_shared", "2026-04-19T10:00:00Z", "Fix login flow", "https://example.com/shared"),
    session("ses_today", "2026-04-19T09:00:00Z", "README checks"),
    session("ses_yesterday", "2026-04-18T08:00:00Z", "Tag cleanup"),
    session("ses_older", "2026-04-16T07:00:00Z", "Planning"),
  ]

  test("shows all workspace sessions except the current session", () => {
    const view = buildSessionPickerView({
      sessions,
      currentSessionId: "ses_current",
      now,
    })

    assert.deepEqual(view.sections.map((section) => ({
      label: section.label,
      ids: section.items.map((item) => item.session.id),
    })), [
      {
        label: "Today",
        ids: ["ses_today_shared", "ses_today"],
      },
      {
        label: "Yesterday",
        ids: ["ses_yesterday"],
      },
      {
        label: "2026-04-16",
        ids: ["ses_older"],
      },
    ])
  })

  test("search matches title, session id, and tags", () => {
    const viewByTitle = buildSessionPickerView({
      sessions,
      currentSessionId: "ses_current",
      query: "readme",
      tagsBySessionId: {
        ses_today: ["docs"],
      },
      now,
    })
    assert.deepEqual(viewByTitle.sections.flatMap((section) => section.items.map((item) => item.session.id)), ["ses_today"])

    const viewById = buildSessionPickerView({
      sessions,
      currentSessionId: "ses_current",
      query: "older",
      now,
    })
    assert.deepEqual(viewById.sections.flatMap((section) => section.items.map((item) => item.session.id)), ["ses_older"])

    const viewByTag = buildSessionPickerView({
      sessions,
      currentSessionId: "ses_current",
      query: "urgent",
      tagsBySessionId: {
        ses_yesterday: ["ops", "urgent"],
      },
      now,
    })
    assert.deepEqual(viewByTag.sections.flatMap((section) => section.items.map((item) => item.session.id)), ["ses_yesterday"])
  })

  test("collects distinct tags for search metadata", () => {
    const view = buildSessionPickerView({
      sessions,
      currentSessionId: "ses_current",
      tagsBySessionId: {
        ses_today: ["docs"],
        ses_yesterday: ["ops", "docs"],
        ses_older: ["planning"],
      },
      now,
    })

    assert.deepEqual(view.availableTags, ["docs", "ops", "planning"])
  })

  test("renders a workspace-only picker with search and no extra controls", () => {
    const html = renderToStaticMarkup(
      <SessionPicker
        payload={{
          workspaceName: "workspace",
          currentSessionId: "ses_current",
          items: [{
            session: sessions[1]!,
            tags: ["auth"],
            related: true,
          }, {
            session: sessions[4]!,
            tags: ["planning"],
            related: false,
          }],
        }}
        onClose={() => {}}
        onSwitch={() => {}}
        now={now}
      />,
    )

    assert.equal(html.includes("Switch session"), true)
    assert.equal(html.includes("Filter sessions"), true)
    assert.equal(html.includes("autofocus"), true)
    assert.equal(html.includes("Fix login flow"), true)
    assert.equal(html.includes(">Related<"), false)
    assert.equal(html.includes(">Workspace<"), false)
    assert.equal(html.includes("All tags"), false)
    assert.equal(html.includes("Rename Fix login flow"), false)
    assert.equal(html.includes("Unshare Fix login flow"), false)
  })

  test("renders an empty workspace state without scope fallback actions", () => {
    const html = renderToStaticMarkup(
      <SessionPicker
        payload={{
          workspaceName: "workspace",
          currentSessionId: "ses_current",
          items: [],
        }}
        onClose={() => {}}
        onSwitch={() => {}}
        now={now}
      />,
    )

    assert.equal(html.includes("No workspace sessions"), true)
    assert.equal(html.includes("Switch to Workspace"), false)
  })

  test("scrolls the active session row into view", () => {
    let selector = ""
    let options: ScrollIntoViewOptions | undefined

    scrollActiveSessionPickerItemIntoView({
      querySelector(next) {
        selector = next
        return {
          scrollIntoView(nextOptions) {
            options = nextOptions
          },
        }
      },
    }, 4)

    assert.equal(selector, "[data-session-index=\"4\"]")
    assert.deepEqual(options, { block: "nearest" })
  })
})
