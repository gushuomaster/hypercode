# Phase 3C/3D Product Capability Alignment Design

## Goal

将语言、主题、帮助和命令能力的跨宿主产品语义收敛到 `packages/product`，同时保留 TUI 的终端主题资产、键盘系统和 VSCode 的面板预设、配置 API 与鼠标交互。

## Scope

Phase 3C covers:

- locale normalization and fallback (`en` / `zh`)
- theme and color-scheme catalog projection
- selected theme fallback when a persisted value is missing or unsupported

Phase 3D covers:

- command capability projection
- deterministic command ordering and visibility filtering
- help topic capability projection
- explicit unsupported results for hosts without a matching help or command action

The following remain host-owned:

- translation dictionaries and loading
- OpenTUI theme JSON, terminal palette detection, and keymap dispatch
- VSCode configuration, CSS variables, command registration, and webview rendering
- command execution, browser/editor navigation, and credential/runtime APIs

## Architecture

`packages/product` receives minimal data-only inputs and returns canonical projections. It does not import Solid, React, OpenTUI, VS Code, translation dictionaries, or runtime services. Host adapters map existing state into Product inputs and map Product actions/results back to existing host APIs.

Product owns normalization, deterministic ordering, fallback, visibility semantics, and capability reasons. A host may expose fewer items or actions; it must report `unsupported` instead of inventing an implementation. Product does not require the TUI and VSCode catalogs to contain identical theme or command IDs.

## Product Contracts

### Locale

`normalizeProductLocale(value)` maps every `zh-*` value to `zh` and every other or missing value to `en`. `deriveProductLocaleState` returns the normalized locale and the deterministic available locale list, defaulting to `['en', 'zh']`.

### Theme

`deriveProductThemeCatalog` accepts theme or color entries with an explicit kind, enabled flag, order, and selected ID. It trims IDs, removes duplicates by kind/ID, keeps disabled entries out of the selectable catalog, and sorts by kind order then explicit order then ID. `deriveProductThemeSelection` keeps a valid persisted selection and falls back to the first available entry of that kind, or `undefined` when the host has no capability.

### Commands

`deriveProductCommandCatalog` accepts minimal command descriptors. It removes hidden entries, normalizes names, preserves source/host capability metadata, deduplicates by command ID, and sorts by category then title then ID. The Product projection never executes a command.

### Help

`deriveProductHelpCatalog` accepts minimal help topic descriptors, removes hidden topics, deduplicates IDs, sorts deterministically, and returns explicit `available` or `unsupported` capability state. A host without a help surface can expose the same topic as `unsupported` without creating a fake UI action.

## Host Integration

TUI uses Product locale normalization in `LanguageProvider`, projects `allThemes()` into the shared theme catalog for `DialogThemeList`, and projects reachable keymap entries into the shared command catalog for `CommandPaletteDialog`. Existing OpenTUI rendering and dispatch remain unchanged.

VSCode uses Product locale normalization in its i18n loader, projects panel theme/color options through the shared theme catalog before rendering `ThemePicker`, and projects slash/server commands through the shared command catalog before autocomplete filtering. Existing VSCode command messages and configuration writes remain unchanged. The VSCode help topic is marked unsupported unless an existing host help action is present.

## Error and Capability Semantics

Invalid locale/theme/command/help input is normalized or excluded, never thrown from Product projection. Missing host capability is represented by `unsupported`; Product does not add archive-like host features or new command APIs. Raw command descriptions and external IDs remain available to host renderers.

## Testing and Acceptance

- Product tests cover locale normalization, theme deduplication/order/fallback, command visibility/order/deduplication, help unsupported projection, and TUI/VSCode-equivalent fixtures.
- TUI and VSCode adapter tests prove equivalent inputs produce equivalent Product projections.
- TUI and VSCode typechecks and focused suites pass; VSIX packaging remains green.
- No Protocol, Server `HttpApi`, generated client, runtime ownership, or unrelated formatting changes.
