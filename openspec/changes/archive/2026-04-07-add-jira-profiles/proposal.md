## Why

The Jira MCP server currently supports a single global `ATLASSIAN_SITE_NAME`, which forces users to duplicate MCP server entries when the same Atlassian account needs to access multiple Jira Cloud sites. Adding profile-based configuration makes the server scalable for consulting and multi-client setups while keeping one central config.

## What Changes

- Add profile-based Jira configuration so one MCP server instance can resolve multiple Jira sites.
- Keep the existing single-site environment variables as the backward-compatible default path.
- Add an optional per-request selector so Jira tools can target a specific configured profile.
- Document the new configuration model and migration path from the current single-site setup.

## Capabilities

### New Capabilities
- `jira-profiles`: Configure multiple named Jira profiles and select which one a Jira MCP tool call should use.

### Modified Capabilities
- None.

## Impact

- Jira configuration loading in `src/utils/config.util.ts`.
- Jira credential resolution and transport in `src/utils/transport.util.ts` and `src/services/vendor.atlassian.api.service.ts`.
- Jira MCP tool schemas and request flow in `src/tools/atlassian.api.types.ts`, `src/tools/atlassian.api.tool.ts`, and `src/controllers/atlassian.api.controller.ts`.
- User-facing setup docs in `README.md` and `.env.example`.
- Automated coverage for config parsing, credential selection, and backward compatibility.
