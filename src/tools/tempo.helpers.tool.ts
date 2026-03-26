import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '../utils/logger.util.js';
import { formatErrorForMcpTool } from '../utils/error.util.js';
import { truncateForAI } from '../utils/formatter.util.js';
import {
	TempoListWorkAttributesArgs,
	TempoListAccountsArgs,
	TempoSearchAccountsArgs,
	TempoGetAccountArgs,
	TempoGetAccountLinksArgs,
	TempoFindAccountsForJiraProjectArgs,
} from './tempo.helpers.types.js';
import {
	handleTempoListWorkAttributes,
	handleTempoListAccounts,
	handleTempoSearchAccounts,
	handleTempoGetAccount,
	handleTempoGetAccountLinks,
	handleTempoFindAccountsForJiraProject,
} from '../controllers/tempo.helpers.controller.js';

const log = Logger.forContext('tools/tempo.helpers.tool.ts');

function wrap<TOpts extends Record<string, unknown>>(
	name: string,
	parse: { parse: (a: unknown) => TOpts },
	handler: (opts: TOpts) => Promise<{ content: string; rawResponsePath?: string | null }>,
) {
	return async (args: Record<string, unknown>) => {
		try {
			const opts = parse.parse(args) as TOpts;
			const result = await handler(opts);
			return {
				content: [
					{
						type: 'text' as const,
						text: truncateForAI(
							result.content,
							result.rawResponsePath ?? null,
						),
					},
				],
			};
		} catch (error) {
			log.error(`tempo helper ${name} failed`, error);
			return formatErrorForMcpTool(error);
		}
	};
}

const LIST_WA_DESC = `List Tempo **work attribute** definitions (keys, types, static values, required flags). Same as GET /work-attributes. Use this before building worklog payloads (e.g. _Contrato_, static lists). Requires TEMPO_API_TOKEN.`;

const LIST_ACC_DESC = `List Tempo **accounts** (contracts) with pagination. Same as GET /accounts. Prefer **tempo_search_accounts** (POST /accounts/search) to filter by **statuses** (e.g. OPEN) or keys without scanning every page.`;

const SEARCH_ACC_DESC = `Search Tempo accounts via **POST /accounts/search**. Pass any combination of **global**, **ids**, **keys**, **statuses** (e.g. \`["OPEN"]\` for active contracts). Empty filters return a broad result set (subject to Tempo API limits).`;

const GET_ACC_DESC = `Get one Tempo account (contract) by **account key**. Same as GET /accounts/{key}.`;

const GET_LINKS_DESC = `List **project/global links** for a Tempo account. Use to see which Jira projects (scope PROJECT) accept this contract. Same as GET /accounts/{key}/links.`;

const FIND_FOR_PROJ_DESC = `Find Tempo contracts **linked** to a Jira project (via account-links). Resolves **jiraProjectKey** with Jira API if you do not pass **jiraProjectId**. By default uses **POST /accounts/search** with \`statuses: ["OPEN"]\` (or CLOSED) so fewer accounts are scanned than GET /pages. Falls back to GET /accounts if search fails. Tune **requestDelayMs** for Tempo rate limits. Optional **customerKey** filters after search.`;

function registerTools(server: McpServer) {
	const r = Logger.forContext('tools/tempo.helpers.tool.ts', 'registerTools');
	r.debug('Registering Tempo helper tools...');

	server.registerTool(
		'tempo_list_work_attributes',
		{
			title: 'Tempo: list work attributes',
			description: LIST_WA_DESC,
			inputSchema: TempoListWorkAttributesArgs,
		},
		wrap('list_work_attributes', TempoListWorkAttributesArgs, handleTempoListWorkAttributes),
	);

	server.registerTool(
		'tempo_list_accounts',
		{
			title: 'Tempo: list accounts (contracts)',
			description: LIST_ACC_DESC,
			inputSchema: TempoListAccountsArgs,
		},
		wrap('list_accounts', TempoListAccountsArgs, handleTempoListAccounts),
	);

	server.registerTool(
		'tempo_search_accounts',
		{
			title: 'Tempo: search accounts (POST /accounts/search)',
			description: SEARCH_ACC_DESC,
			inputSchema: TempoSearchAccountsArgs,
		},
		wrap('search_accounts', TempoSearchAccountsArgs, handleTempoSearchAccounts),
	);

	server.registerTool(
		'tempo_get_account',
		{
			title: 'Tempo: get account by key',
			description: GET_ACC_DESC,
			inputSchema: TempoGetAccountArgs,
		},
		wrap('get_account', TempoGetAccountArgs, handleTempoGetAccount),
	);

	server.registerTool(
		'tempo_get_account_links',
		{
			title: 'Tempo: get account ↔ project links',
			description: GET_LINKS_DESC,
			inputSchema: TempoGetAccountLinksArgs,
		},
		wrap('get_account_links', TempoGetAccountLinksArgs, handleTempoGetAccountLinks),
	);

	server.registerTool(
		'tempo_find_accounts_for_jira_project',
		{
			title: 'Tempo: find contracts linked to Jira project',
			description: FIND_FOR_PROJ_DESC,
			inputSchema: TempoFindAccountsForJiraProjectArgs,
		},
		wrap(
			'find_accounts_for_jira_project',
			TempoFindAccountsForJiraProjectArgs,
			handleTempoFindAccountsForJiraProject,
		),
	);

	r.debug('Tempo helper tools registered');
}

export default { registerTools };
