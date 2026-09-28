# HyperCode Cross-Host Product Contract Design

## Status

This design supersedes the command and capability-status closure claims in
`2026-09-24-product-alignment-maintenance-baseline.md`. The earlier Product Alignment work
established useful projection modules, but later investigation found that several shared
decisions are still owned independently by the TUI and VSCode hosts.

The implementation must preserve unrelated session-selection work already present in the
working tree.

## Problem

HyperCode intends `packages/product` to be the sole owner of behavior shared by TUI and
VSCode. The current implementation does not fully enforce that boundary:

- Product command projection filters and sorts a catalog that each Host has already chosen.
- TUI slash commands are assembled from several local registration sites, while VSCode owns
  a separate local slash-action array and execution switch.
- Dynamic server, MCP-business-command and Skill entries are mixed with local product actions
  without a canonical collision and source policy.
- Product projects individual MCP, LSP and formatter states, but Hosts still calculate overall
  tones, counts, empty-state meaning and status priority.
- LSP runtime status cannot distinguish an explicitly disabled capability from an enabled,
  lazily idle capability unless configuration is included in the Product input.
- Existing adapter tests prove that each adapter calls Product. They do not prove that
  equivalent TUI and VSCode facts produce equivalent product behavior.

The result is surface-level reuse rather than single ownership. Upstream changes or local Host
work can therefore create drift without breaking the current test suites.

## Goals

1. Give Product canonical ownership of shared capability identity and user-visible semantics.
2. Preserve legitimate Host-specific presentation and execution details.
3. Make unsupported and Host-only behavior explicit instead of silently omitting it.
4. Give MCP, LSP and formatter status one shared interpretation and aggregation policy.
5. Add proof obligations that fail when either Host reintroduces shared product decisions.
6. Add upstream-sync gates that detect semantic drift rather than relying on text search,
   compilation or packaging success.

## Non-goals

- Making TUI and VSCode visually identical.
- Moving terminal, editor, window, focus, input or rendering APIs into Product.
- Moving raw messages, parts or protocol payloads into Product.
- Inventing runtime instances or claiming a capability is active when Core has not reported it.
- Removing dynamic server commands, plugin compatibility or Host-native shortcuts.
- Refactoring unrelated Product modules merely because they exist in the same package.

## Ownership Model

The system is divided into four layers:

```text
Core / Config / Runtime
  factual configuration, raw runtime status, protocol capability, dynamic commands
      -> packages/product
         canonical capability IDs, catalog policy, availability, state machines,
         aggregation, action intent, ordering, collision rules and semantic text keys
          -> Host adapters
             raw-shape normalization and truthful supported/unsupported/host_only declarations
              -> TUI / VSCode
                 rendering, input, focus, editor/terminal APIs and execution bindings
```

Core owns facts and side effects. Product owns what those facts mean to a HyperCode user. A
Host owns how the meaning is rendered and how an approved Product action is executed through
that Host.

Product must not accept a pre-decided final shared catalog from a Host. It may accept dynamic
entries and capability declarations, then produce the final product catalog itself.

## Capability Contract

Every user-visible command or action receives a stable semantic ID independent of its label,
slash spelling or Host handler name. Entries are classified as:

- `shared`: both Hosts expose the same semantic capability and command vocabulary.
- `shared_surface_optional`: both Hosts share behavior, but may expose it through different
  surfaces such as a slash command, toolbar button or context menu.
- `host_only`: the capability depends on a Host facility and the other Host is not expected to
  emulate it.

Availability is distinct from scope:

- `available`: executable in the current context.
- `unavailable`: supported by the Host but temporarily inapplicable; Product supplies a reason
  text key.
- `unsupported`: the Host cannot provide the shared capability.

Host-only entries remain explicit in Host declarations and diagnostics, but Product does not
require another Host to expose them.

### Initial Shared Slash Catalog

The first canonical shared slash vocabulary is:

| Semantic ID | Canonical slash | Aliases |
| --- | --- | --- |
| `session.new` | `/new` | `/clear` where compatibility is retained |
| `session.list` | `/sessions` | `/resume`, `/continue` |
| `agent.list` | `/agents` | none |
| `model.list` | `/models` | `/model`, `/mo` |
| `variant.list` | `/variants` | none |
| `provider.connect` | `/connect` | none |
| `mcp.list` | `/mcps` | `/mcp` |
| `system.status` | `/status` | none |
| `session.compact` | `/compact` | none |
| `session.undo` | `/undo` | none |
| `session.redo` | `/redo` | none |
| `skill.list` | `/skills` | none |
| `theme.list` | `/themes` | `/theme` |
| `help.show` | `/help` | none |

Availability may hide an entry from a compact picker presentation, but the Product result must
still retain its unsupported or unavailable reason for diagnostics and parity tests.

Existing commands including `debug`, `exit`, `editor`, `diff`, `warp`, `move`, `workspaces`,
`refresh`, `reset-agent`, session export and display toggles enter an explicit audit matrix.
They are classified from real capability dependencies, not from their current file location.

### Dynamic Commands

Dynamic entries retain distinct sources:

- server-defined user command;
- MCP-provided business command;
- Skill command;
- built-in Product action;
- Host-only command.

`/mcps` manages MCP connections. A command whose source is `mcp` is a business command supplied
by an MCP server. They must never share an identity merely because both contain the term MCP.

Product owns source precedence, collision handling, alias resolution, filtering and deterministic
ordering. Hosts provide localized dynamic descriptions only when the protocol does not yet carry
a semantic text key.

## Action Execution

The Product catalog returns action intent, never Host callbacks. Shared actions use stable
`ProductAction` variants. Host adapters bind supported actions to SDK, terminal or editor calls.

Execution follows one lifecycle:

1. Product resolves the command and validates contextual availability.
2. Host starts the mapped action and reports pending state.
3. Core or Host returns refreshed facts or a typed failure.
4. Product derives the new state and semantic error.
5. Host renders the result without inventing fallback or recovery behavior.

An unsupported action returns `unsupported`. Unknown commands remain distinct from known but
unavailable commands. Operation failures must be visible to users and preserve raw diagnostics;
logging to a developer console alone is insufficient.

## Capability Status Model

Status projection separates configuration, runtime and aggregate meaning.

### MCP

MCP input includes configuration enablement, raw runtime status, supported actions and pending
operation state. Product distinguishes:

- configuration: `unconfigured`, `enabled`, `disabled`, `unsupported`;
- runtime: `idle`, `connecting`, `connected`, `needs_auth`,
  `needs_client_registration`, `failed`;
- aggregate: `unconfigured`, `disabled`, `idle`, `healthy`, `degraded`, `failed`,
  `needs_attention`, `unsupported`.

An enabled server that failed to connect is never labeled disabled. A mixture of connected and
failed servers is degraded; all failures are failed. Authentication and client-registration
states keep their own semantic error and recovery action.

### LSP

LSP input combines resolved configuration with actual runtime instances:

- resolved `lsp: false` produces `disabled`;
- enabled configuration with no matching active instance produces `idle` and means enabled,
  lazy activation;
- connected instances without errors produce `healthy`;
- connected and failed instances produce `degraded`;
- failed instances without a connected instance produce `failed`;
- missing Host support produces `unsupported`.

Product does not enumerate every potential language server before Core starts it. VSCode editor
language services remain distinct from HyperCode Runtime LSP, and the HyperCode status surface
must say which system it represents.

### Formatter and Shared Aggregation

Formatter enters the same audit and aggregation contract. Product may retain subsystem-specific
states, but it owns common summary properties:

- aggregate availability;
- severity;
- active, configured and failed counts;
- semantic summary text key;
- default recovery action where one exists.

Hosts must not calculate overall status color or interpret an empty array as disabled. They map
Product severity to their own visual tokens.

## Text and Diagnostics

Product outputs semantic text keys and preserves raw diagnostic text, code and source. TUI and
VSCode localize the same keys. User-visible Chinese coverage is required for configured,
disabled, idle, pending, connected, degraded, authentication-required, registration-required,
failed and unsupported states where applicable.

Third-party errors remain available verbatim for diagnosis, accompanied by a localized Product
explanation.

## Migration and Compatibility

The implementation keeps existing command spellings as aliases where they are already public.
Dynamic command payloads and the TUI plugin command shim remain compatibility boundaries.

Migration proceeds in narrow vertical slices:

1. Introduce Product command definitions, context projection and shared fixtures.
2. Adapt both command menus and execution resolvers to Product output.
3. Introduce truthful MCP/LSP configuration-plus-runtime inputs and Product summaries.
4. Replace Host aggregate logic and incorrect status labels.
5. Audit remaining Product modules and Host reducers for duplicate ownership.
6. Remove only code proven to have no protocol, persistence, plugin or supported-runtime duty.

No compatibility path may retain a second owner of ordering, availability, state priority,
fallback or recovery semantics.

## Verification Contract

Testing is based on semantic equivalence, not merely code reuse.

### Product Tests

- canonical built-in catalog, aliases, source precedence and collision policy;
- contextual available, unavailable and unsupported outcomes;
- MCP/LSP/formatter individual and aggregate state matrices;
- action intent and semantic error keys;
- deterministic behavior independent of Host input ordering.

### Shared Host Fixtures

One fixture set represents equivalent facts in TUI and VSCode raw shapes. Each Host adapter must
project those fixtures to the same Product result. Fixtures cover catalogs, execution targets,
configuration, empty/idle states, mixed failures and recovery actions.

### Negative Ownership Checks

Tests and focused source audits fail when first-party Host code reintroduces:

- shared built-in catalog definitions;
- alias or collision policy;
- availability fallback;
- aggregate status priority or overall tone calculation;
- default recovery selection;
- semantic error selection.

A source audit is supporting evidence only. Product and shared-fixture behavior tests are the
authoritative proof.

### Verification Commands

Every contract change runs Product tests and typecheck, TUI Product and adapter tests plus
typecheck, VSCode Product and adapter tests plus `check-types`, VSCode packaging, and diff hygiene.
Full-suite failures are compared by identity against the maintained known-debt baseline.

## Upstream Synchronization Gate

Any upstream change touching a shared capability definition, Host command registration,
availability input, state schema, status renderer, action binding, text key or Product adapter
triggers `Cross-Host Product Contract Review`.

The review records:

- affected semantic capability IDs;
- whether the change modifies facts, Product meaning, Host support or presentation only;
- TUI and VSCode capability declarations;
- shared-fixture results;
- any new `host_only` or `unsupported` classification and its rationale;
- Product Default Review when omission or activation semantics also change.

Build, typecheck, package and text search success cannot satisfy this gate. Missing shared-fixture
evidence or unexplained Host divergence produces `NEEDS_HUMAN_DECISION` and blocks merge-back.

## Documentation Changes

Implementation updates the following durable documents:

- the Product Alignment maintenance baseline, marking the earlier command/status closure claim
  as corrected by this contract;
- `docs/规范/上游同步工作流总纲.md`, adding the contract review gate and output requirements;
- `docs/规范/上游同步与品牌化规范.md`, adding shared Product ownership to high-risk surfaces;
- `docs/操作手册/上游同步操作流程.md`, adding the capability matrix, shared-fixture commands,
  classification requirements and merge-back stop conditions.

The build and delivery guide receives only the manual cross-host smoke checks that apply to
actual packaged artifacts; architecture policy remains in the Product and synchronization docs.

## Completion Criteria

The work is complete only when:

- both Hosts consume the Product-owned shared command catalog;
- equivalent commands resolve to equivalent Product actions;
- MCP, LSP and formatter overall semantics are Product-owned;
- disabled, idle and failed states are truthfully distinguishable;
- TUI no longer labels MCP failures as disabled;
- shared fixtures prove cross-host equivalence;
- negative ownership checks protect the boundary;
- durable synchronization documentation contains the new review gate;
- focused tests, all package typechecks and VSCode packaging pass with no new regression.
