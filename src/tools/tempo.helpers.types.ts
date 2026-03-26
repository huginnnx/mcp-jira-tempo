import { z } from 'zod';
import { OutputFormat } from './atlassian.api.types.js';

/** Pagination for Tempo list endpoints (offset/limit are strings in queryParams). */
const PaginationSchema = {
	offset: z
		.string()
		.optional()
		.describe('Pagination offset (default "0").'),
	limit: z
		.string()
		.optional()
		.describe('Page size (default "50", max per Tempo docs often 100–5000 depending on endpoint).'),
	outputFormat: OutputFormat,
	jq: z
		.string()
		.optional()
		.describe('Optional JMESPath applied to the raw Tempo JSON response.'),
};

export const TempoListWorkAttributesArgs = z.object({
	...PaginationSchema,
});

export const TempoListAccountsArgs = z.object({
	...PaginationSchema,
});

/** Body for POST /accounts/search (Tempo API v4). Omit fields you do not need. */
export const TempoSearchAccountsArgs = z.object({
	global: z
		.boolean()
		.optional()
		.describe('Filter global accounts when true/false as supported by Tempo.'),
	ids: z
		.array(z.number().int())
		.optional()
		.describe('Restrict to Tempo account numeric ids.'),
	keys: z
		.array(z.string())
		.optional()
		.describe('Restrict to Tempo account keys (e.g. "AL2D.26.0306").'),
	statuses: z
		.array(z.string())
		.optional()
		.describe(
			'Status filter, e.g. ["OPEN"] for active contracts, ["ARCHIVED"], or multiple.',
		),
	outputFormat: OutputFormat,
	jq: z.string().optional(),
});

export const TempoGetAccountArgs = z.object({
	accountKey: z
		.string()
		.min(1)
		.describe('Tempo account key, e.g. "AL2D.26.0306".'),
	outputFormat: OutputFormat,
	jq: z.string().optional(),
});

export const TempoGetAccountLinksArgs = z.object({
	accountKey: z
		.string()
		.min(1)
		.describe('Tempo account key whose project/global links you want to list.'),
	outputFormat: OutputFormat,
	jq: z.string().optional(),
});

export const TempoFindAccountsForJiraProjectArgs = z.object({
	jiraProjectKey: z
		.string()
		.optional()
		.describe(
			'Jira project key (e.g. "DEV"). Resolved to numeric id via Jira API. Provide this or jiraProjectId.',
		),
	jiraProjectId: z
		.string()
		.optional()
		.describe(
			'Jira project id as returned by Jira REST (string). Provide this or jiraProjectKey.',
		),
	accountStatus: z
		.enum(['OPEN', 'CLOSED', 'ANY'])
		.default('OPEN')
		.describe(
			'Filter Tempo accounts by status before checking project links. Use OPEN for active contracts when logging time.',
		),
	customerKey: z
		.string()
		.optional()
		.describe(
			'Optional Tempo customer key to narrow results (e.g. same as project key in many setups). Omit to include any customer.',
		),
	maxPages: z
		.number()
		.int()
		.min(1)
		.max(50)
		.default(15)
		.describe(
			'Fallback: max GET /accounts pages when POST /accounts/search is unavailable. Usually unused when search works.',
		),
	useAccountsSearch: z
		.boolean()
		.default(true)
		.describe(
			'Use POST /accounts/search with statuses filter (recommended). Set false to scan GET /accounts only.',
		),
	requestDelayMs: z
		.number()
		.int()
		.min(50)
		.max(2000)
		.default(220)
		.describe(
			'Delay between Tempo link requests to respect rate limits (Tempo ~5 req/s).',
		),
	outputFormat: OutputFormat,
	jq: z.string().optional(),
}).refine((v) => Boolean(v.jiraProjectKey || v.jiraProjectId), {
	message: 'Provide jiraProjectKey or jiraProjectId',
});

export type TempoListWorkAttributesArgsType = z.infer<
	typeof TempoListWorkAttributesArgs
>;
export type TempoListAccountsArgsType = z.infer<typeof TempoListAccountsArgs>;
export type TempoSearchAccountsArgsType = z.infer<typeof TempoSearchAccountsArgs>;
export type TempoGetAccountArgsType = z.infer<typeof TempoGetAccountArgs>;
export type TempoGetAccountLinksArgsType = z.infer<
	typeof TempoGetAccountLinksArgs
>;
export type TempoFindAccountsForJiraProjectArgsType = z.infer<
	typeof TempoFindAccountsForJiraProjectArgs
>;
