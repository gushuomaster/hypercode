# HyperCode Product Default Policy Design

## Status and purpose

This design establishes how HyperCode chooses defaults for user-visible capabilities after Product Alignment closure. It is maintenance governance, not a new architecture phase.

The trigger is the LSP default: upstream intentionally changed an omitted `lsp` setting from enabled to disabled. The change is internally consistent upstream, but it also demonstrates that an upstream default is not automatically the right HyperCode product default. HyperCode must evaluate the resulting user experience instead of treating upstream intent as product acceptance.

## Product principle

HyperCode defaults are chosen for HyperCode users. Upstream supplies mechanisms, compatibility constraints and a reference policy; it does not own downstream product decisions.

Users should receive core coding value without first learning internal subsystem names or editing configuration. A capability should therefore be available by default when it materially improves the primary coding workflow, has no destructive effect, can activate lazily and can fail without blocking the task.

Defaults must not silently authorize data disclosure, destructive actions, unbounded spending or uncontrolled network installation. Enabling a capability and allowing it to download dependencies are separate decisions.

## Decision model

Every user-visible capability default is evaluated across these dimensions:

| Dimension | Question |
| --- | --- |
| Core value | Does it directly improve code understanding, generation, validation or recovery? |
| User expectation | Would a typical HyperCode user reasonably expect it to work without configuration? |
| Side effects | Can it modify files, execute commands, expose data or alter external state? |
| Cost | Can it incur provider charges or substantial local resource use? |
| Network | Can it contact public services or download executable content? |
| Activation | Can it remain dormant until a relevant workflow needs it? |
| Failure isolation | Can failure remain visible and non-blocking? |
| Environment | Does policy differ for online, offline, enterprise, TUI or VSCode delivery? |
| Reversibility | Can users disable it and recover the prior behavior predictably? |

The resulting default classes are:

1. `default_on_lazy`: core, non-destructive value that starts only when needed.
2. `default_on_passive`: observation or status capability with negligible side effects.
3. `environment_managed`: useful by default, but network, installation or availability is constrained by the delivery profile.
4. `explicit_opt_in`: data disclosure, public sharing, telemetry, paid consumption, destructive behavior or other meaningful external side effects.
5. `explicit_unsupported`: the host cannot provide the capability and must not emulate it.

An omitted setting must resolve to an intentional HyperCode class. Omission must never inherit an upstream semantic accidentally.

## Initial policy hypotheses

These entries seed the audit; they are not implementation results until verified against actual runtime behavior and delivery constraints.

| Capability | Initial class | Required constraint |
| --- | --- | --- |
| LSP analysis | `default_on_lazy` | Start only for relevant files; failure remains non-blocking |
| LSP dependency download | `environment_managed` | Online builds may allow it; offline and controlled builds must disable public downloads |
| Formatter | audit required | Separate diagnostics from automatic file mutation and respect project configuration |
| Configured MCP server | audit required | Do not install unknown servers silently; preserve explicit enable/disable state |
| Model catalog refresh | `environment_managed` | Online builds may refresh; offline builds use controlled snapshots/configuration |
| Automatic update | `environment_managed` | Never bypass offline or managed deployment policy |
| Session sharing | `explicit_opt_in` | No data leaves the machine without explicit user action |
| Telemetry | `explicit_opt_in` | Consent and disclosure are required |
| Paid model use | `explicit_opt_in` | Model choice and expected charging semantics remain visible |
| Permission auto-approval | `explicit_opt_in` | High-impact operations retain explicit policy and visible risk |
| Installed skills/plugins | audit required | Loading installed code is distinct from downloading new code |

## LSP product decision

For HyperCode, LSP analysis should be enabled by default and activated lazily because it improves diagnostics and code navigation without needing to modify files. Users may explicitly disable it.

Network installation is a separate policy:

- standard online delivery may allow managed LSP downloads with visible status;
- offline and controlled enterprise delivery must set `OPENCODE_DISABLE_LSP_DOWNLOAD=1` and use only locally available or packaged servers;
- a missing or failed server produces a clear, non-blocking unavailable/error state;
- TUI and VSCode render the same Product capability semantics even though VSCode may also run editor-owned language servers.

The implementation audit must determine whether this belongs in a HyperCode default resolver, generated configuration, installer profile or a combination with versioned migration. It must not be implemented as an unexplained one-off edit to a user's current config.

## Ownership

`packages/product` owns cross-host presentation semantics for capability availability, activation state, error meaning and user-facing text keys. TUI and VSCode render that projection and expose host-specific controls.

Core/config/runtime owns actual process startup, file matching, dependency discovery and environment policy. Product must not own raw LSP processes or protocol payloads.

Installers and delivery templates own online/offline deployment defaults such as whether executable dependencies may be downloaded. They must not create a different TUI versus VSCode product outcome for the same runtime profile.

## Default-behavior audit

The maintenance audit covers user-visible settings and implicit defaults in Core, CLI/TUI, VSCode and delivery templates. For each capability it records:

- behavior when the setting is omitted, `false`, `true` and an object/value override where applicable;
- whether the behavior changed from the maintained HyperCode baseline or upstream;
- the Product Default Policy classification and rationale;
- online, offline and enterprise differences;
- migration behavior for existing users;
- TUI/VSCode parity and any legitimate host-only capability;
- tests and documentation that lock the decision.

The first audit set includes LSP, formatter, MCP activation, model catalog refresh, updates, sharing, telemetry, permission auto-approval, paid model selection and skill/plugin loading. Additional capabilities enter the matrix when discovered; the audit does not justify unrelated refactoring.

## Upstream synchronization gate

An upstream change requires explicit product review when it changes any of the following:

- the meaning of an omitted setting;
- a default from on to off or off to on;
- lazy activation, automatic installation or network access;
- permission, sharing, telemetry, charging or destructive semantics;
- fallback behavior or failure recovery visible to users;
- differences between TUI and VSCode outcomes.

Such a change is classified as `ACCEPT_UPSTREAM_DEFAULT`, `PRESERVE_HYPERCODE_DEFAULT`, `PROFILE_SPECIFIC_DEFAULT` or `NEEDS_HUMAN_DECISION`. Build success alone cannot resolve the classification.

## Verification

Each accepted policy requires tests at the lowest owning layer and parity coverage where both hosts expose it. Verification must include:

- omitted/false/true/override fixtures for configurable capabilities;
- online/offline profile checks for network-managed behavior;
- lazy activation and non-blocking failure tests where applicable;
- Product projection parity between TUI and VSCode;
- upgrade/migration coverage when an existing user's behavior changes;
- user-visible Chinese text coverage for disabled, pending, connected, unavailable and error states that apply.

The existing Product/TUI/VSCode maintenance baseline remains the regression reference. This policy does not reopen closed Product Alignment phases.

## Deliverables after approval

1. Add a concise Product Default Policy rule to the root `AGENTS.md`.
2. Add the upstream default-behavior review gate to the synchronization specifications and operating procedure.
3. Produce a versioned audit matrix for the initial capability set.
4. Implement only decisions supported by the audit, beginning with LSP.
5. Update delivery templates, user documentation and regression coverage together with each changed default.

## Non-goals

- Treating every upstream difference as a defect.
- Enabling every available subsystem by default.
- Moving runtime process ownership into `packages/product`.
- Silently enabling network downloads in offline or managed environments.
- Editing current user configuration as a substitute for a product default and migration design.
- Creating a Phase 5 solely to contain normal maintenance work.
