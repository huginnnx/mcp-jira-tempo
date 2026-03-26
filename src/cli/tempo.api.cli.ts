import { Command } from 'commander';
import { Logger } from '../utils/logger.util.js';
import { handleCliError } from '../utils/error.util.js';
import {
	handleTempoGet,
	handleTempoPost,
	handleTempoPut,
	handleTempoPatch,
	handleTempoDelete,
} from '../controllers/tempo.api.controller.js';

const cliLogger = Logger.forContext('cli/tempo.api.cli.ts');
cliLogger.debug('Tempo API CLI module initialized');

function parseJson<T extends Record<string, unknown>>(
	jsonString: string,
	fieldName: string,
): T {
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonString);
	} catch {
		throw new Error(
			`Invalid JSON in --${fieldName}. Please provide valid JSON.`,
		);
	}

	if (
		parsed === null ||
		typeof parsed !== 'object' ||
		Array.isArray(parsed)
	) {
		throw new Error(
			`Invalid --${fieldName}: expected a JSON object, got ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed}.`,
		);
	}

	return parsed as T;
}

function registerReadCommand(
	program: Command,
	name: string,
	description: string,
	handler: (options: {
		path: string;
		queryParams?: Record<string, string>;
		jq?: string;
		outputFormat?: 'toon' | 'json';
	}) => Promise<{ content: string }>,
): void {
	program
		.command(name)
		.description(description)
		.requiredOption(
			'-p, --path <path>',
			'Tempo API path (e.g. "/work-attributes", "/worklogs").',
		)
		.option(
			'-q, --query-params <json>',
			'Query parameters as JSON string.',
		)
		.option('--jq <expression>', 'JMESPath expression.')
		.option(
			'--output-format <format>',
			'Output format: "toon" (default) or "json".',
			'toon',
		)
		.action(async (options) => {
			const actionLogger = cliLogger.forMethod(`tempo ${name}`);
			try {
				actionLogger.debug(`CLI tempo ${name} called`, options);

				let queryParams: Record<string, string> | undefined;
				if (options.queryParams) {
					queryParams = parseJson<Record<string, string>>(
						options.queryParams,
						'query-params',
					);
				}

				const result = await handler({
					path: options.path,
					queryParams,
					jq: options.jq,
					outputFormat: options.outputFormat as 'toon' | 'json',
				});

				console.log(result.content);
			} catch (error) {
				handleCliError(error);
			}
		});
}

function registerWriteCommand(
	program: Command,
	name: string,
	description: string,
	handler: (options: {
		path: string;
		body: Record<string, unknown>;
		queryParams?: Record<string, string>;
		jq?: string;
		outputFormat?: 'toon' | 'json';
	}) => Promise<{ content: string }>,
): void {
	program
		.command(name)
		.description(description)
		.requiredOption('-p, --path <path>', 'Tempo API path.')
		.requiredOption('-b, --body <json>', 'Request body as JSON string.')
		.option('-q, --query-params <json>', 'Query parameters as JSON string.')
		.option('--jq <expression>', 'JMESPath expression.')
		.option(
			'--output-format <format>',
			'Output format: "toon" (default) or "json".',
			'toon',
		)
		.action(async (options) => {
			const actionLogger = cliLogger.forMethod(`tempo ${name}`);
			try {
				actionLogger.debug(`CLI tempo ${name} called`, options);

				const body = parseJson<Record<string, unknown>>(
					options.body,
					'body',
				);

				let queryParams: Record<string, string> | undefined;
				if (options.queryParams) {
					queryParams = parseJson<Record<string, string>>(
						options.queryParams,
						'query-params',
					);
				}

				const result = await handler({
					path: options.path,
					body,
					queryParams,
					jq: options.jq,
					outputFormat: options.outputFormat as 'toon' | 'json',
				});

				console.log(result.content);
			} catch (error) {
				handleCliError(error);
			}
		});
}

function register(program: Command): void {
	const methodLogger = Logger.forContext('cli/tempo.api.cli.ts', 'register');
	methodLogger.debug('Registering Tempo CLI commands...');

	const tempo = program
		.command('tempo')
		.description(
			'Tempo Cloud REST API v4 (requires TEMPO_API_TOKEN; optional TEMPO_API_BASE_URL, default https://api.tempo.io/4).',
		);

	registerReadCommand(
		tempo,
		'get',
		'GET any Tempo endpoint. TOON by default; use --output-format json.',
		handleTempoGet,
	);

	registerWriteCommand(
		tempo,
		'post',
		'POST to any Tempo endpoint.',
		handleTempoPost,
	);

	registerWriteCommand(
		tempo,
		'put',
		'PUT to any Tempo endpoint.',
		handleTempoPut,
	);

	registerWriteCommand(
		tempo,
		'patch',
		'PATCH any Tempo endpoint.',
		handleTempoPatch,
	);

	registerReadCommand(
		tempo,
		'delete',
		'DELETE any Tempo endpoint.',
		handleTempoDelete,
	);

	methodLogger.debug('Tempo CLI commands registered successfully');
}

export default { register };
