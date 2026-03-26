import tempoApiService from '../services/vendor.tempo.api.service.js';
import { Logger } from '../utils/logger.util.js';
import { handleControllerError } from '../utils/error-handler.util.js';
import { ControllerResponse } from '../types/common.types.js';
import {
	type TempoGetApiToolArgsType,
	type TempoRequestWithBodyArgsType,
} from '../tools/tempo.api.types.js';
import { applyJqFilter, toOutputString } from '../utils/jq.util.js';

const logger = Logger.forContext('controllers/tempo.api.controller.ts');

type OutputFormat = 'toon' | 'json';

interface BaseRequestOptions {
	path: string;
	queryParams?: Record<string, string>;
	jq?: string;
	outputFormat?: OutputFormat;
}

interface RequestWithBodyOptions extends BaseRequestOptions {
	body?: Record<string, unknown>;
}

async function handleRequest(
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
	options: RequestWithBodyOptions,
): Promise<ControllerResponse> {
	const methodLogger = logger.forMethod(`handle${method}`);

	try {
		methodLogger.debug(`Making Tempo ${method} request`, {
			path: options.path,
			...(options.body && { bodyKeys: Object.keys(options.body) }),
		});

		const response = await tempoApiService.request<unknown>(
			options.path,
			{
				method,
				queryParams: options.queryParams,
				body: options.body,
			},
		);

		methodLogger.debug('Successfully received response from Tempo service');

		const result = applyJqFilter(response.data, options.jq);
		const useToon = options.outputFormat !== 'json';
		const content = await toOutputString(result, useToon);

		return {
			content,
			rawResponsePath: response.rawResponsePath,
		};
	} catch (error) {
		throw handleControllerError(error, {
			entityType: 'Tempo API',
			operation: `${method} request`,
			source: `controllers/tempo.api.controller.ts@handle${method}`,
			additionalInfo: { path: options.path },
		});
	}
}

export async function handleTempoGet(
	options: TempoGetApiToolArgsType,
): Promise<ControllerResponse> {
	return handleRequest('GET', options);
}

export async function handleTempoPost(
	options: TempoRequestWithBodyArgsType,
): Promise<ControllerResponse> {
	return handleRequest('POST', options);
}

export async function handleTempoPut(
	options: TempoRequestWithBodyArgsType,
): Promise<ControllerResponse> {
	return handleRequest('PUT', options);
}

export async function handleTempoPatch(
	options: TempoRequestWithBodyArgsType,
): Promise<ControllerResponse> {
	return handleRequest('PATCH', options);
}

export async function handleTempoDelete(
	options: TempoGetApiToolArgsType,
): Promise<ControllerResponse> {
	return handleRequest('DELETE', options);
}
