import { z } from 'zod';
import { OutputFormat } from './atlassian.api.types.js';

const BaseTempoApiToolArgs = {
	path: z
		.string()
		.min(1, 'Path is required')
		.describe(
			'Tempo REST API path (without base URL). Base defaults to TEMPO_API_BASE_URL (https://api.tempo.io/4). Examples: "/work-attributes", "/worklogs", "/worklogs/{id}/work-attribute-values". See https://apidocs.tempo.io/',
		),

	queryParams: z
		.record(z.string(), z.string())
		.optional()
		.describe(
			'Optional query parameters as key-value strings. Examples: {"limit": "50", "offset": "0"}',
		),

	jq: z
		.string()
		.optional()
		.describe(
			'JMESPath expression to filter/transform the response. Use to reduce token usage.',
		),

	outputFormat: OutputFormat,
};

const bodyField = z
	.record(z.string(), z.unknown())
	.describe(
		'Request body as JSON. Structure depends on the Tempo endpoint (e.g. POST /worklogs with issueId, timeSpentSeconds, attributes).',
	);

export const TempoGetApiToolArgs = z.object(BaseTempoApiToolArgs);
export type TempoGetApiToolArgsType = z.infer<typeof TempoGetApiToolArgs>;

export const TempoRequestWithBodyArgs = z.object({
	...BaseTempoApiToolArgs,
	body: bodyField,
});
export type TempoRequestWithBodyArgsType = z.infer<
	typeof TempoRequestWithBodyArgs
>;

export const TempoDeleteApiToolArgs = TempoGetApiToolArgs;
export type TempoDeleteApiToolArgsType = z.infer<typeof TempoDeleteApiToolArgs>;
