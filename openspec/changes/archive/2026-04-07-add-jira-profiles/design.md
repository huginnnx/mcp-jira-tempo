## Context

The current Jira request flow assumes one global credential set for the whole server instance: configuration loads `ATLASSIAN_SITE_NAME`, `ATLASSIAN_USER_EMAIL`, and `ATLASSIAN_API_TOKEN`, then the transport layer derives `https://${siteName}.atlassian.net` for every Jira request. This works for single-tenant usage but forces users to duplicate MCP server entries when they access multiple Jira Cloud sites with the same Atlassian account or token.

This change crosses several layers: config parsing, credential resolution, tool schemas, controller/service request flow, and user-facing documentation. The implementation must preserve the current single-site setup so existing MCP configurations continue working without edits.

## Goals / Non-Goals

**Goals:**
- Allow one Jira MCP server instance to define multiple named Jira profiles.
- Allow Jira tool calls to optionally select a profile for a request.
- Preserve the current single-site environment variables as the default/fallback configuration.
- Keep credential resolution deterministic and easy to debug.
- Document how to configure and use profiles.

**Non-Goals:**
- Changing Tempo configuration or introducing Tempo profiles.
- Auto-discovering Jira sites from Atlassian APIs.
- Adding cross-request session state such as "current active profile" stored in memory.
- Removing the existing `ATLASSIAN_*` environment variable contract.

## Decisions

### Use named profiles instead of multiple flat site variables

The server will support a structured Jira profile map rather than parallel env vars such as `ATLASSIAN_SITE_NAME_2`. Profiles scale better when different sites eventually need different emails or tokens, and they map naturally to the user's mental model of "company Jira" vs "client Jira".

Alternatives considered:
- Multiple flat env vars: simple at first, but naming becomes brittle and hard to document.
- Site override only: solves today's case, but does not scale when credentials differ by site.

### Keep the current single-site config as the default compatibility path

If no profiles are configured, the server will continue using `ATLASSIAN_SITE_NAME`, `ATLASSIAN_USER_EMAIL`, and `ATLASSIAN_API_TOKEN`. This avoids a breaking change for current users and lets profiles be introduced incrementally.

Alternatives considered:
- Require migration to profiles immediately: cleaner model, but unnecessarily breaking.

### Add an optional `profile` selector to Jira tool inputs

Each Jira MCP tool will accept an optional `profile` field. When present, the request flow resolves credentials from that named profile. When omitted, the server uses the default profile if configured, otherwise it falls back to the legacy single-site credentials.

This is preferable to adding `siteName` directly to each request because:
- it keeps request payloads stable even if credentials differ per site,
- it avoids exposing multiple auth fields in every tool call,
- and it aligns better with user-facing docs and reusable MCP prompts.

Alternatives considered:
- `siteName` argument only: simpler, but ties the contract to one field and weakens future extensibility.

### Support profiles from config file and optional serialized environment input

The design should prioritize structured config via global config (`~/.mcp/configs.json`) because it already supports nested objects and is easier to read for multiple profiles. For `.env`-style setups, the implementation may support a serialized JSON variable such as `ATLASSIAN_PROFILES_JSON` plus `ATLASSIAN_DEFAULT_PROFILE`, or document profiles as a config-file-first feature if plain env ergonomics become too awkward.

Alternatives considered:
- Config-file only: cleanest implementation, but limits users who rely on env-based MCP configs.
- Env-only serialization with no config file support: works, but makes large setups less readable.

### Resolve credentials once per request in the service layer

Credential selection should happen before the transport call, based on the incoming `profile` selector. The transport layer should receive a fully resolved credential object and remain responsible only for request execution and URL construction. This preserves layer boundaries and keeps testing straightforward.

Alternatives considered:
- Resolve profile inside transport: possible, but mixes config lookup with raw HTTP behavior.

## Risks / Trade-offs

- Ambiguous fallback behavior when profiles and legacy env vars coexist -> Define and document a strict precedence order: explicit request profile, configured default profile, legacy single-site credentials.
- `.env` representation for nested profiles may become awkward -> Prefer global config for rich profile definitions and keep env support minimal but explicit.
- Invalid profile names could produce confusing runtime failures -> Add clear validation and actionable error messages listing the requested profile and available configured profiles.
- More tool input surface can slightly increase prompt complexity -> Keep `profile` optional and document that most users can omit it when they have a default profile.

## Migration Plan

1. Introduce profile-aware config parsing and credential resolution while preserving legacy behavior.
2. Add `profile` as an optional Jira tool input and thread it through controller/service layers.
3. Update docs with both legacy single-site examples and profile-based examples.
4. Add tests for legacy fallback, default profile selection, explicit profile selection, and unknown profile errors.
5. Release without requiring config changes from existing users.

Rollback strategy:
- Remove profile-aware resolution and continue using the legacy single-site credentials only.
- Existing users remain unaffected because the legacy path stays intact throughout the rollout.

## Open Questions

- Whether `.env.example` should advertise profile JSON env support immediately or keep profile setup documented primarily in `README.md`.
