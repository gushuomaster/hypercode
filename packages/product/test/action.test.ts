import { describe, expect, test } from "bun:test"
import { deriveProductActionEffect } from "../src"
import { productActionFixtures } from "./fixtures/product-actions"

describe("deriveProductActionEffect", () => {
  test("keeps provider recovery intents host-neutral", () => {
    const actions = [
      { type: "provider.connect", providerID: "openai" },
      { type: "provider.authenticate", providerID: "openai" },
      { type: "provider.openDocs", providerID: "openai" },
      { type: "provider.retry", providerID: "openai" },
    ] as const

    expect(actions.map((action) => [action.type, deriveProductActionEffect(action)])).toEqual([
      ["provider.connect", { clearComposer: false, clearError: true }],
      ["provider.authenticate", { clearComposer: false, clearError: true }],
      ["provider.openDocs", { clearComposer: false, clearError: true }],
      ["provider.retry", { clearComposer: false, clearError: true }],
    ])
  })

  test("defines composer reset semantics independently of the host", () => {
    expect(productActionFixtures.map((action) => [action.type, deriveProductActionEffect(action)])).toEqual([
      ["composer.submit", { clearComposer: true, clearError: true }],
      ["session.interrupt", { clearComposer: false, clearError: true }],
      ["session.retry", { clearComposer: false, clearError: true }],
      ["session.compact", { clearComposer: true, clearError: true }],
      ["session.undo", { clearComposer: true, clearError: true }],
      ["session.redo", { clearComposer: true, clearError: true }],
      ["session.select", { clearComposer: true, clearError: true }],
      ["session.switch", { clearComposer: true, clearError: true }],
      ["model.select", { clearComposer: false, clearError: true }],
      ["agent.select", { clearComposer: false, clearError: true }],
      ["variant.select", { clearComposer: false, clearError: true }],
      ["permission.reply", { clearComposer: false, clearError: true }],
      ["question.reply", { clearComposer: false, clearError: true }],
      ["question.reject", { clearComposer: false, clearError: true }],
    ])
  })
})
