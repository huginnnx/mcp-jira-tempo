## 1. Configuration Model

- [x] 1.1 Extend Jira config loading to parse named profiles and an optional default profile while preserving the legacy single-site `ATLASSIAN_*` variables.
- [x] 1.2 Define and implement the precedence rules for credential resolution: explicit request profile, configured default profile, then legacy single-site credentials.
- [x] 1.3 Add validation and error helpers for unknown or incomplete Jira profiles.

## 2. Jira Request Flow

- [x] 2.1 Add an optional `profile` field to Jira MCP tool schemas and thread it through controller and service request types.
- [x] 2.2 Update Jira credential resolution so each request selects the correct profile before calling the transport layer.
- [x] 2.3 Keep the transport layer backward-compatible by continuing to build Jira URLs from the resolved credential object.

## 3. Documentation And Verification

- [x] 3.1 Update `README.md` with profile-based configuration examples, default profile behavior, and backward-compatible legacy examples.
- [x] 3.2 Update `.env.example` to reflect the supported configuration path or explicitly point profile-based setups to the documented JSON/config approach.
- [x] 3.3 Add or update tests covering legacy fallback, default profile selection, explicit profile selection, and unknown profile errors.
