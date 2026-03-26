import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '../utils/logger.util.js';
import { formatErrorForMcpTool } from '../utils/error.util.js';
import { truncateForAI } from '../utils/formatter.util.js';
import {
	TempoGetApiToolArgs,
	type TempoGetApiToolArgsType,
	TempoRequestWithBodyArgs,
	type TempoRequestWithBodyArgsType,
	TempoDeleteApiToolArgs,
} from './tempo.api.types.js';
import {
	handleTempoGet,
	handleTempoPost,
	handleTempoPut,
	handleTempoPatch,
	handleTempoDelete,
} from '../controllers/tempo.api.controller.js';

const toolLogger = Logger.forContext('tools/tempo.api.tool.ts');
toolLogger.debug('Tempo API tool initialized');

function createReadHandler(
	methodName: string,
	handler: (
		options: TempoGetApiToolArgsType,
	) => Promise<{ content: string; rawResponsePath?: string | null }>,
) {
	return async (args: Record<string, unknown>) => {
		const methodLogger = Logger.forContext(
			'tools/tempo.api.tool.ts',
			methodName.toLowerCase(),
		);
		methodLogger.debug(`Making Tempo ${methodName} request with args:`, args);

		try {
			const result = await handler(args as TempoGetApiToolArgsType);

			methodLogger.debug(
				'Successfully retrieved response from Tempo controller',
			);

			return {
				content: [
					{
						type: 'text' as const,
						text: truncateForAI(
							result.content,
							result.rawResponsePath,
						),
					},
				],
			};
		} catch (error) {
			methodLogger.error(
				`Failed to make Tempo ${methodName} request`,
				error,
			);
			return formatErrorForMcpTool(error);
		}
	};
}

function createWriteHandler(
	methodName: string,
	handler: (
		options: TempoRequestWithBodyArgsType,
	) => Promise<{ content: string; rawResponsePath?: string | null }>,
) {
	return async (args: Record<string, unknown>) => {
		const methodLogger = Logger.forContext(
			'tools/tempo.api.tool.ts',
			methodName.toLowerCase(),
		);
		methodLogger.debug(`Making Tempo ${methodName} request with args:`, {
			path: args.path,
			bodyKeys: args.body ? Object.keys(args.body as object) : [],
		});

		try {
			const result = await handler(args as TempoRequestWithBodyArgsType);

			methodLogger.debug(
				'Successfully received response from Tempo controller',
			);

			return {
				content: [
					{
						type: 'text' as const,
						text: truncateForAI(
							result.content,
							result.rawResponsePath,
						),
					},
				],
			};
		} catch (error) {
			methodLogger.error(
				`Failed to make Tempo ${methodName} request`,
				error,
			);
			return formatErrorForMcpTool(error);
		}
	};
}

const get = createReadHandler('GET', handleTempoGet);
const post = createWriteHandler('POST', handleTempoPost);
const put = createWriteHandler('PUT', handleTempoPut);
const patch = createWriteHandler('PATCH', handleTempoPatch);
const del = createReadHandler('DELETE', handleTempoDelete);

const TEMPO_GET_DESCRIPTION = `Read Tempo Cloud data (worklogs, work attributes, plans, etc.). Uses Bearer token (TEMPO_API_TOKEN). Returns TOON by default.

**Base URL:** TEMPO_API_BASE_URL (default \`https://api.tempo.io/4\`). \`path\` is appended to that base (e.g. \`/work-attributes\`).

**Work attributes workflow:**
1. \`tempo_get\` \`path: "/work-attributes"\` — list definitions (keys, types, static options).
2. Create/update worklogs with \`attributes\` in the body per Tempo docs (keys often like \`_MyField_\` with \`{ "value": "..." }\`).

**Cost:** Always use \`jq\` to filter large lists.

Docs: https://apidocs.tempo.io/`;

const TEMPO_POST_DESCRIPTION = `Create Tempo resources (e.g. worklogs). Bearer auth. Returns TOON by default.

**Worklogs:** \`path: "/worklogs"\` with body fields per API v4 (e.g. \`issueId\`, \`timeSpentSeconds\`, \`startDate\`, \`attributes\`).

Docs: https://apidocs.tempo.io/`;

const TEMPO_PUT_DESCRIPTION = `Replace Tempo resources (full update). Bearer auth. Returns TOON by default.

Docs: https://apidocs.tempo.io/`;

const TEMPO_PATCH_DESCRIPTION = `Partially update Tempo resources. Bearer auth. Returns TOON by default.

Docs: https://apidocs.tempo.io/`;

const TEMPO_DELETE_DESCRIPTION = `Delete Tempo resources. Bearer auth. Returns TOON by default.

Docs: https://apidocs.tempo.io/`;

function registerTools(server: McpServer) {
	const registerLogger = Logger.forContext(
		'tools/tempo.api.tool.ts',
		'registerTools',
	);
	registerLogger.debug('Registering Tempo API tools...');

	server.registerTool(
		'tempo_get',
		{
			title: 'Tempo GET Request',
			description: TEMPO_GET_DESCRIPTION,
			inputSchema: TempoGetApiToolArgs,
		},
		get,
	);

	server.registerTool(
		'tempo_post',
		{
			title: 'Tempo POST Request',
			description: TEMPO_POST_DESCRIPTION,
			inputSchema: TempoRequestWithBodyArgs,
		},
		post,
	);

	server.registerTool(
		'tempo_put',
		{
			title: 'Tempo PUT Request',
			description: TEMPO_PUT_DESCRIPTION,
			inputSchema: TempoRequestWithBodyArgs,
		},
		put,
	);

	server.registerTool(
		'tempo_patch',
		{
			title: 'Tempo PATCH Request',
			description: TEMPO_PATCH_DESCRIPTION,
			inputSchema: TempoRequestWithBodyArgs,
		},
		patch,
	);

	server.registerTool(
		'tempo_delete',
		{
			title: 'Tempo DELETE Request',
			description: TEMPO_DELETE_DESCRIPTION,
			inputSchema: TempoDeleteApiToolArgs,
		},
		del,
	);

	registerLogger.debug('Successfully registered Tempo API tools');
}

export default { registerTools };
