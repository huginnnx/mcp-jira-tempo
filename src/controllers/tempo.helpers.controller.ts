import atlassianApiService from '../services/vendor.atlassian.api.service.js';
import tempoApiService from '../services/vendor.tempo.api.service.js';
import { Logger } from '../utils/logger.util.js';
import { handleControllerError } from '../utils/error-handler.util.js';
import { ControllerResponse } from '../types/common.types.js';
import { applyJqFilter, toOutputString } from '../utils/jq.util.js';
import type {
	TempoListWorkAttributesArgsType,
	TempoListAccountsArgsType,
	TempoSearchAccountsArgsType,
	TempoGetAccountArgsType,
	TempoGetAccountLinksArgsType,
	TempoFindAccountsForJiraProjectArgsType,
} from '../tools/tempo.helpers.types.js';

const logger = Logger.forContext('controllers/tempo.helpers.controller.ts');

type OutputFormat = 'toon' | 'json';

function toQueryParams(
	offset?: string,
	limit?: string,
): Record<string, string> | undefined {
	const q: Record<string, string> = {};
	if (offset !== undefined) q.offset = offset;
	if (limit !== undefined) q.limit = limit;
	return Object.keys(q).length ? q : undefined;
}

async function finalizeOutput(
	data: unknown,
	jq: string | undefined,
	outputFormat: OutputFormat | undefined,
): Promise<ControllerResponse> {
	const result = applyJqFilter(data, jq);
	const useToon = outputFormat !== 'json';
	const content = await toOutputString(result, useToon);
	return { content, rawResponsePath: null };
}

export async function handleTempoListWorkAttributes(
	options: TempoListWorkAttributesArgsType,
): Promise<ControllerResponse> {
	try {
		const response = await tempoApiService.get<unknown>(
			'/work-attributes',
			toQueryParams(options.offset ?? '0', options.limit ?? '50'),
		);
		return finalizeOutput(
			response.data,
			options.jq,
			options.outputFormat,
		);
	} catch (error) {
		throw handleControllerError(error, {
			entityType: 'Tempo helpers',
			operation: 'list work attributes',
			source: 'controllers/tempo.helpers.controller.ts@handleTempoListWorkAttributes',
		});
	}
}

export async function handleTempoListAccounts(
	options: TempoListAccountsArgsType,
): Promise<ControllerResponse> {
	try {
		const response = await tempoApiService.get<unknown>(
			'/accounts',
			toQueryParams(options.offset ?? '0', options.limit ?? '50'),
		);
		return finalizeOutput(
			response.data,
			options.jq,
			options.outputFormat,
		);
	} catch (error) {
		throw handleControllerError(error, {
			entityType: 'Tempo helpers',
			operation: 'list accounts',
			source: 'controllers/tempo.helpers.controller.ts@handleTempoListAccounts',
		});
	}
}

function compactSearchBody(
	options: TempoSearchAccountsArgsType,
): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (options.global !== undefined) body.global = options.global;
	if (options.ids?.length) body.ids = options.ids;
	if (options.keys?.length) body.keys = options.keys;
	if (options.statuses?.length) body.statuses = options.statuses;
	return body;
}

export async function handleTempoSearchAccounts(
	options: TempoSearchAccountsArgsType,
): Promise<ControllerResponse> {
	try {
		const response = await tempoApiService.post<unknown>(
			'/accounts/search',
			compactSearchBody(options),
		);
		return finalizeOutput(
			response.data,
			options.jq,
			options.outputFormat,
		);
	} catch (error) {
		throw handleControllerError(error, {
			entityType: 'Tempo helpers',
			operation: 'search accounts',
			source: 'controllers/tempo.helpers.controller.ts@handleTempoSearchAccounts',
		});
	}
}

export async function handleTempoGetAccount(
	options: TempoGetAccountArgsType,
): Promise<ControllerResponse> {
	try {
		const key = encodeURIComponent(options.accountKey);
		const response = await tempoApiService.get<unknown>(`/accounts/${key}`);
		return finalizeOutput(
			response.data,
			options.jq,
			options.outputFormat,
		);
	} catch (error) {
		throw handleControllerError(error, {
			entityType: 'Tempo helpers',
			operation: 'get account',
			source: 'controllers/tempo.helpers.controller.ts@handleTempoGetAccount',
			additionalInfo: { accountKey: options.accountKey },
		});
	}
}

interface TempoAccountRow {
	key?: string;
	id?: number;
	name?: string;
	status?: string;
	customer?: { key?: string; name?: string };
	links?: { self?: string };
}

interface TempoLinksResponse {
	results?: Array<{
		scope?: { id?: number; type?: string; self?: string };
		default?: boolean;
	}>;
}

export async function handleTempoGetAccountLinks(
	options: TempoGetAccountLinksArgsType,
): Promise<ControllerResponse> {
	try {
		const key = encodeURIComponent(options.accountKey);
		const response = await tempoApiService.get<unknown>(
			`/accounts/${key}/links`,
		);
		return finalizeOutput(
			response.data,
			options.jq,
			options.outputFormat,
		);
	} catch (error) {
		throw handleControllerError(error, {
			entityType: 'Tempo helpers',
			operation: 'get account links',
			source: 'controllers/tempo.helpers.controller.ts@handleTempoGetAccountLinks',
			additionalInfo: { accountKey: options.accountKey },
		});
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

interface TempoAccountSearchPage {
	results?: TempoAccountRow[];
	metadata?: { next?: string };
}

async function collectAccountsViaSearch(
	searchBody: Record<string, unknown>,
	maxPages: number,
	requestDelayMs: number,
	pageSize: number,
): Promise<TempoAccountRow[]> {
	const rows: TempoAccountRow[] = [];
	let offset = 0;

	for (let page = 0; page < maxPages; page++) {
		const listResp = await tempoApiService.post<TempoAccountSearchPage>(
			'/accounts/search',
			searchBody,
			{
				offset: String(offset),
				limit: String(pageSize),
			},
		);

		const batch = listResp.data.results ?? [];
		rows.push(...batch);
		if (!listResp.data.metadata?.next || batch.length === 0) {
			break;
		}
		offset += pageSize;
		await sleep(requestDelayMs);
	}

	return rows;
}

async function collectAccountsViaGet(
	maxPages: number,
	requestDelayMs: number,
	pageSize: number,
): Promise<TempoAccountRow[]> {
	const rows: TempoAccountRow[] = [];
	let offset = 0;

	for (let page = 0; page < maxPages; page++) {
		const listResp = await tempoApiService.get<{
			results?: TempoAccountRow[];
			metadata?: { next?: string };
		}>('/accounts', {
			offset: String(offset),
			limit: String(pageSize),
		});

		const batch = listResp.data.results ?? [];
		rows.push(...batch);
		if (!listResp.data.metadata?.next || batch.length === 0) {
			break;
		}
		offset += pageSize;
		await sleep(requestDelayMs);
	}

	return rows;
}

export async function handleTempoFindAccountsForJiraProject(
	options: TempoFindAccountsForJiraProjectArgsType,
): Promise<ControllerResponse> {
	const methodLogger = logger.forMethod('handleTempoFindAccountsForJiraProject');

	try {
		let projectIdNum: number;
		if (options.jiraProjectId) {
			projectIdNum = Number(options.jiraProjectId);
			if (!Number.isFinite(projectIdNum)) {
				throw new Error(
					`Invalid jiraProjectId: ${options.jiraProjectId}`,
				);
			}
		} else if (options.jiraProjectKey) {
			const key = encodeURIComponent(options.jiraProjectKey);
			const projResp = await atlassianApiService.get<{
				id?: string;
				key?: string;
				name?: string;
			}>(`/rest/api/3/project/${key}`);
			const idStr = projResp.data?.id;
			if (!idStr) {
				throw new Error(
					`Jira project not found or no id for key: ${options.jiraProjectKey}`,
				);
			}
			projectIdNum = Number(idStr);
			if (!Number.isFinite(projectIdNum)) {
				throw new Error(`Unexpected Jira project id: ${idStr}`);
			}
			methodLogger.debug('Resolved Jira project', {
				key: options.jiraProjectKey,
				id: projectIdNum,
				name: projResp.data?.name,
			});
		} else {
			throw new Error('Provide jiraProjectKey or jiraProjectId');
		}

		const matches: Array<{
			accountKey: string;
			accountId: number;
			name: string;
			status: string;
			customerKey?: string;
			defaultForProject: boolean;
		}> = [];

		const pageSize = 100;
		let rows: TempoAccountRow[] = [];
		let source: 'POST /accounts/search' | 'GET /accounts' =
			'POST /accounts/search';

		const searchBody: Record<string, unknown> = {};
		if (options.accountStatus === 'OPEN') {
			searchBody.statuses = ['OPEN'];
		} else if (options.accountStatus === 'CLOSED') {
			searchBody.statuses = ['CLOSED'];
		}

		if (options.useAccountsSearch) {
			try {
				rows = await collectAccountsViaSearch(
					searchBody,
					options.maxPages,
					options.requestDelayMs,
					pageSize,
				);
			} catch (e) {
				methodLogger.warn(
					'POST /accounts/search failed; falling back to GET /accounts',
					e,
				);
				source = 'GET /accounts';
				rows = await collectAccountsViaGet(
					options.maxPages,
					options.requestDelayMs,
					pageSize,
				);
			}
		} else {
			source = 'GET /accounts';
			rows = await collectAccountsViaGet(
				options.maxPages,
				options.requestDelayMs,
				pageSize,
			);
		}

		let linkChecks = 0;
		for (const acc of rows) {
			const accKey = acc.key;
			if (!accKey || !acc.links?.self) continue;

			if (options.accountStatus !== 'ANY' && source === 'GET /accounts') {
				if (acc.status !== options.accountStatus) continue;
			}

			if (
				options.customerKey &&
				acc.customer?.key !== options.customerKey
			) {
				continue;
			}

			await sleep(options.requestDelayMs);
			linkChecks += 1;
			const linksResp = await tempoApiService.get<TempoLinksResponse>(
				`/accounts/${encodeURIComponent(accKey)}/links`,
				{ limit: '50', offset: '0' },
			);

			for (const link of linksResp.data.results ?? []) {
				if (
					link.scope?.type === 'PROJECT' &&
					link.scope.id === projectIdNum
				) {
					matches.push({
						accountKey: accKey,
						accountId: acc.id as number,
						name: acc.name ?? '',
						status: acc.status ?? 'UNKNOWN',
						customerKey: acc.customer?.key,
						defaultForProject: Boolean(link.default),
					});
				}
			}
		}

		const payload = {
			jiraProjectId: projectIdNum,
			filters: {
				accountStatus: options.accountStatus,
				customerKey: options.customerKey ?? null,
				accountsSource: source,
				searchBody:
					source === 'POST /accounts/search' ? searchBody : null,
				linkChecks,
			},
			linkedAccounts: matches,
			hint:
				matches.length === 0
					? 'No matching linked accounts. Try tempo_search_accounts with explicit keys/statuses, raise maxPages, set accountStatus to ANY, useAccountsSearch false, or remove customerKey.'
					: options.accountStatus === 'OPEN'
						? 'Prefer OPEN accounts for new time logs when multiple links exist.'
						: undefined,
		};

		return finalizeOutput(
			payload,
			options.jq,
			options.outputFormat,
		);
	} catch (error) {
		throw handleControllerError(error, {
			entityType: 'Tempo helpers',
			operation: 'find accounts for Jira project',
			source:
				'controllers/tempo.helpers.controller.ts@handleTempoFindAccountsForJiraProject',
		});
	}
}
