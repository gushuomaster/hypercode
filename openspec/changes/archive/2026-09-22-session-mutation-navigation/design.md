# Session Mutation and Subagent Navigation Design

## Goal

Unify session mutation and subagent navigation behavior across the HyperCode TUI and VSCode extension without moving raw Core session, message, part, or protocol payloads into `packages/product`.

The shared Product domain decides whether an operation is available, owns its lifecycle and canonical product projection, normalizes failures, and resolves navigation targets. Host adapters execute existing SDK or host APIs and render the resulting state.

## Scope

Phase 2C covers:

- `session.rename`
- `session.archive`
- `session.share`
- `session.unshare`
- `session.tag.add`
- `session.tag.remove`
- mutation availability
- mutation lifecycle
- canonical mutable session projection
- semantic errors and raw diagnostics

Phase 2D covers:

- parent and child relationships
- deterministic child and sibling order
- active-child preference
- parent, child, previous, and next targets
- navigation availability
- missing, removed, archived, and unavailable targets

The following remain out of scope:

- Protocol or Server `HttpApi` changes
- generated client changes
- provider, MCP, LSP, formatter, theme, language, help, or command-palette work
- copying complete Core session, message, part, permission, question, or retry payloads into Product
- adding archive or tag persistence to a host that does not already provide it

## Architecture

`packages/product` remains a pure TypeScript package with no React, Solid, OpenTUI, VS Code API, DOM runtime, or host-specific Node runtime dependency.

```text
UI intent
   │
   ▼
ProductAction
   │
   ├─ Product validates availability and begins pending state
   │
   ▼
Host adapter executes existing SDK or host API
   │
   ├─ success result ──► Product commits canonical projection
   └─ failure result ──► Product records semantic error and preserves canonical projection
```

Navigation follows the same ownership rule:

```text
Core relationship input
   │
   ▼
Product navigation projection and target resolution
   │
   ▼
Host performs the resolved navigation and renders host-specific UI
```

Product decides what an action means and where navigation goes. Hosts decide how SDK calls, VS Code commands, OpenTUI dialogs, shortcuts, breadcrumbs, tree expansion, and notifications are implemented.

## Product Modules

Add two focused modules:

- `packages/product/src/session-mutation.ts`
- `packages/product/src/session-navigation.ts`

`session-mutation.ts` owns action availability, lifecycle reduction, mutable canonical session fields, result validation, and semantic error normalization.

`session-navigation.ts` owns relationship normalization, deterministic ordering, navigation projection, and action target resolution.

The modules are exported through `packages/product/src/index.ts`. Existing session list, selection, switching, snapshot ownership, and raw renderer payload boundaries remain intact.

## Canonical Mutable Session Projection

Product stores only fields needed for cross-host mutation behavior:

- session ID
- normalized title
- archived timestamp
- share URL
- normalized tags
- host capability flags
- availability flags required by shared actions

It does not store complete Core `SessionInfo`, messages, parts, tool payloads, permission payloads, questions, or protocol events.

Host inputs hydrate this projection from their current data. Successful mutation results update it immediately after host confirmation. Later authoritative Core or host hydration may replace the same fields.

Tags remain host-local where that is already true. Product owns normalization, duplicate handling, availability, lifecycle, and canonical tag projection; VSCode continues to persist tags with `SessionTagStore`. TUI reports tag mutations as unsupported until it has a real persistence capability.

## Product Actions

Extend `ProductAction` with session mutation intents carrying the target session ID and only the data required by the action:

- `session.rename` with a title
- `session.archive`
- `session.share`
- `session.unshare`
- `session.tag.add` with a tag
- `session.tag.remove` with a tag

Add subagent navigation intents consistent with the existing action style:

- `subagent.open` for the Product-selected default child
- `subagent.back` for the Product-selected parent
- `subagent.select` for an explicit Product-validated target

Previous and next sibling commands resolve through the shared navigation resolver rather than through host-owned wraparound logic. The final naming may use a direction field if that keeps the union smaller, but the semantics remain Product-owned.

## Mutation Availability

Product derives availability from canonical session state, current mutation state, and host capability input.

Shared rules include:

- rename requires an existing, available session and host rename support
- archive requires an existing, unarchived session and host archive support
- share requires an existing, unshared session and host share support
- unshare requires an existing, shared session and host unshare support
- tag add requires host tag support and a normalized tag not already present
- tag remove requires host tag support and a normalized tag currently present
- a mutation already pending for the same session and operation is unavailable

Product returns an explicit reason such as `unsupported`, `not_found`, `unavailable`, `already_archived`, `already_shared`, `not_shared`, `invalid_title`, `duplicate_tag`, or `missing_tag`. Hosts must not silently no-op or substitute a different action.

Capability is an input to Product rather than a host-owned business rule. TUI maps absent archive and tag facilities to unsupported capabilities. VSCode maps its existing SDK and `SessionTagStore` facilities to supported capabilities.

## Mutation Lifecycle

Each session mutation is represented by a shared lifecycle state:

- `idle`
- `pending`
- `success`
- `error`

The state is keyed by session ID and mutation kind so unrelated sessions and unrelated operations do not overwrite each other.

Beginning an available action records `pending` and preserves the canonical session projection. A host success result records `success` and applies the validated canonical update. A host failure result records `error`, preserves the previous canonical projection unchanged, and stores a normalized semantic error plus its raw diagnostic.

The first implementation uses confirmation-after-host semantics for every mutation. There is no optimistic canonical update and therefore no separate rollback branch. The invariant is:

```text
pending or failure => canonical mutable session fields are unchanged
success            => canonical mutable session fields reflect the confirmed result
```

## Success Results

Host adapters return normalized results rather than exposing host response shapes to Product:

- rename success supplies the confirmed title
- archive success supplies the confirmed archived timestamp
- share success supplies the confirmed share URL
- unshare success confirms removal of the share URL
- tag add/remove success supplies the confirmed normalized tag list

When an SDK operation does not return enough data, the adapter may use the result of its existing refresh or the exact confirmed request value. It must not mark success before the host operation completes.

## Error Semantics

Product normalizes failures into semantic codes and shared `ProductTextKey` values while retaining the original diagnostic string.

Required semantic classes are:

- session not found
- unsupported capability
- unavailable action
- already archived
- already shared
- invalid title
- permission denied
- network or server request failure
- unknown failure

Host adapters may inspect existing SDK error fields, status codes, and messages to build a neutral failure input. Product performs the final semantic classification. No new Server error type is introduced.

User-visible handling keeps the shared Chinese semantic explanation and the raw third-party or server diagnostic. Host notification APIs and layouts remain host-specific.

## Host Integration

### TUI

The TUI adapter maps Product actions to existing SDK calls and existing dialogs. Rename, share, and unshare use the shared lifecycle and result semantics. Archive and tags return explicit unsupported targets unless an existing real host capability is found during implementation.

The TUI removes local child-selection and sibling-wraparound rules. Existing keybindings and OpenTUI presentation remain unchanged.

### VSCode

The VSCode adapter maps Product actions to existing SDK calls, refresh flows, `SessionTagStore`, clipboard access, commands, and notifications. Existing confirmation prompts remain host UI, but Product decides action availability and mutation meaning.

The webview and provider remove independent navigation fallback. Tree expansion, session reveal, breadcrumbs, mouse input, and keyboard shortcuts remain VSCode responsibilities.

## Subagent Navigation Projection

Product consumes a minimal relationship graph:

- session ID
- parent ID
- archived state
- availability
- deterministic order fields
- optional active-child candidate

It derives:

- current node
- parent target
- ordered direct children
- default child target
- previous sibling target
- next sibling target
- availability and explicit unavailable reason for each direction

Archived and unavailable nodes are excluded as valid targets. Ordering is deterministic and independent of host collection order.

The default child rule is:

1. use the active-child candidate when it is a valid direct or permitted descendant target in the current graph
2. otherwise use the first valid child in deterministic order
3. otherwise return an explicit unavailable result

Previous and next sibling navigation wraps only when the shared projection contains more than one valid sibling. Product returns no target for a missing current node, removed target, archived target, unavailable target, or a relationship inconsistent with the graph. Hosts do not choose another target.

## Data Flow

Mutation flow:

1. UI dispatches a `ProductAction`.
2. Product derives availability.
3. Product begins the mutation and returns a host execution intent.
4. The adapter performs the existing SDK or host operation.
5. The adapter returns a normalized success or failure event.
6. Product reduces the result into lifecycle and canonical mutable session state.
7. The host renders Product state and may display host-specific notifications.

Navigation flow:

1. The adapter maps Core session relations into the minimal Product graph.
2. Product derives the navigation projection.
3. UI dispatches a shared subagent action or direction.
4. Product validates and returns one exact target or an explicit unavailable result.
5. The host performs navigation without additional fallback.

## Testing

Product tests cover:

- every mutation availability rule
- pending, success, and error transitions
- canonical update only after success
- canonical preservation after failure
- semantic error and raw diagnostic retention
- title and tag normalization
- archive, share, and tag repeated-action handling
- deterministic relationship projection
- active-child preference and first-child fallback
- parent, previous, next, and explicit selection
- missing, removed, archived, and unavailable targets
- A to child to parent and sibling navigation sequences

Cross-host parity fixtures verify that TUI and VSCode adapters map the same supported action and result to the same Product intent, lifecycle, canonical state, error semantics, and navigation target. Capability-specific tests verify explicit TUI unsupported results rather than pretending the hosts have identical facilities.

Validation includes full Product tests and typecheck, related TUI tests and typecheck, related VSCode tests, VSCode `check-types`, VSIX packaging, cross-host parity suites, `git diff --check`, and a VSCode full-suite comparison against the recorded Part A baseline.

## Commit and Migration Strategy

Before Phase 2C and 2D implementation, the existing Phase 1 through Phase 2B work is audited, validated, and committed in the smallest dependency-safe architecture boundaries. The preferred split is Product foundation, TUI integration, VSCode integration, and documentation, but boundaries may be combined when an intermediate commit would not typecheck or test.

Phase 2C and Phase 2D are committed separately when their Product contract and host integrations form independently verifiable states. No push, rebase, reset, stash, clean, Protocol change, generated-client regeneration, or Phase 3 implementation is part of this work.

## Acceptance Criteria

- Product is the single source for session mutation availability and lifecycle.
- Product updates canonical mutable session state only after confirmed success.
- Failure preserves canonical state and exposes semantic plus raw diagnostics.
- Unsupported host capabilities are explicit.
- Product is the single source for subagent navigation targets and fallback.
- Hosts contain no independent shared mutation recovery or navigation fallback rules.
- Raw Core data remains owned by Core and host renderers.
- Product remains free of UI and host runtime dependencies.
- Product, TUI, VSCode, parity, typecheck, package, and regression validation introduce no new failures relative to the Part A baseline.
