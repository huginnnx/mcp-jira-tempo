## ADDED Requirements

### Requirement: Jira server supports named profiles
The Jira MCP server SHALL support configuring multiple named Jira profiles, where each profile defines the Jira Cloud site name and the credentials required to authenticate requests for that site.

#### Scenario: Multiple profiles are configured
- **WHEN** the server loads Jira configuration that contains more than one named profile
- **THEN** it SHALL make those profiles available for Jira request resolution within the same server instance

#### Scenario: Default profile is configured
- **WHEN** the server loads a configured default Jira profile name
- **THEN** it SHALL use that profile as the default Jira target for requests that do not specify a profile

### Requirement: Jira tools allow per-request profile selection
Each Jira MCP tool SHALL accept an optional `profile` input that selects which configured Jira profile to use for that request.

#### Scenario: Request specifies a known profile
- **WHEN** a Jira MCP tool call includes a `profile` value that matches a configured Jira profile
- **THEN** the server SHALL execute the request against that profile's Jira site

#### Scenario: Request omits profile and default exists
- **WHEN** a Jira MCP tool call omits `profile`
- **THEN** the server SHALL use the configured default Jira profile if one exists

### Requirement: Legacy single-site configuration remains supported
The Jira MCP server SHALL preserve support for the existing single-site configuration based on `ATLASSIAN_SITE_NAME`, `ATLASSIAN_USER_EMAIL`, and `ATLASSIAN_API_TOKEN`.

#### Scenario: Legacy credentials are the only Jira config
- **WHEN** no Jira profiles are configured and the legacy single-site credentials are present
- **THEN** the server SHALL execute Jira requests using the legacy single-site configuration

#### Scenario: Existing request omits profile under legacy configuration
- **WHEN** a Jira MCP tool call omits `profile` and the server is configured only with legacy single-site credentials
- **THEN** the request SHALL behave the same as it did before profile support was added

### Requirement: Unknown profile errors are actionable
The Jira MCP server SHALL reject requests that specify an unknown Jira profile with an error that clearly identifies the requested profile and indicates that the profile is not configured.

#### Scenario: Request specifies unknown profile
- **WHEN** a Jira MCP tool call includes a `profile` value that does not match any configured Jira profile
- **THEN** the server SHALL fail the request before making an outbound Jira API call

#### Scenario: Unknown profile error is returned
- **WHEN** the server rejects a request because the requested profile is not configured
- **THEN** the error message SHALL include the unknown profile name and guidance to review the Jira profile configuration
