import { Logger } from '../utils/logger.util.js';
import {
	fetchTempo,
	getTempoCredentials,
	type TempoCredentials,
} from '../utils/tempo.transport.util.js';
import { createAuthMissingError, McpError } from '../utils/error.util.js';

const serviceLogger = Logger.forContext(
	'services/vendor.tempo.api.service.ts',
);

serviceLogger.debug('Tempo API service initialized');

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface TempoApiRequestOptions {
	method?: HttpMethod;
	queryParams?: Record<string, string>;
	body?: Record<string, unknown>;
}

export function validateTempoCredentials(): TempoCredentials {
	const methodLogger = Logger.forContext(
		'services/vendor.tempo.api.service.ts',
		'validateTempoCredentials',
	);

	const credentials = getTempoCredentials();
	if (!credentials) {
		methodLogger.error('Missing Tempo credentials');
		throw createAuthMissingError(
			'Tempo credentials missing. Set TEMPO_API_TOKEN (from Jira → Tempo → Settings → Data Access → API Integration). Optional: TEMPO_API_BASE_URL (default https://api.tempo.io/4).',
		);
	}

	methodLogger.debug('Tempo credentials validated');
	return credentials;
}

export function normalizePath(path: string): string {
	let normalizedPath = path;
	if (!normalizedPath.startsWith('/')) {
		normalizedPath = '/' + normalizedPath;
	}
	return normalizedPath;
}

export function appendQueryParams(
	path: string,
	queryParams?: Record<string, string>,
): string {
	if (!queryParams || Object.keys(queryParams).length === 0) {
		return path;
	}
	const queryString = new URLSearchParams(queryParams).toString();
	return path + (path.includes('?') ? '&' : '?') + queryString;
}

export async function request<T = unknown>(
	path: string,
	options: TempoApiRequestOptions = {},
): Promise<{ data: T; rawResponsePath: string | null }> {
	const methodLogger = Logger.forContext(
		'services/vendor.tempo.api.service.ts',
		'request',
	);

	const method = options.method || 'GET';
	methodLogger.debug(`Making ${method} Tempo request to ${path}`);

	try {
		const credentials = validateTempoCredentials();

		let normalizedPath = normalizePath(path);
		normalizedPath = appendQueryParams(normalizedPath, options.queryParams);

		methodLogger.debug(`Normalized Tempo path: ${normalizedPath}`);

		const fetchOptions: {
			method: HttpMethod;
			body?: unknown;
		} = {
			method,
		};

		if (options.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
			fetchOptions.body = options.body;
		}

		const response = await fetchTempo<T>(
			credentials,
			normalizedPath,
			fetchOptions,
		);

		methodLogger.debug('Successfully received response from Tempo API');
		return response;
	} catch (error) {
		methodLogger.error(
			`Tempo service error during ${method} request to ${path}`,
			error,
		);

		if (error instanceof McpError) {
			throw error;
		}

		throw error;
	}
}

export async function get<T = unknown>(
	path: string,
	queryParams?: Record<string, string>,
): Promise<{ data: T; rawResponsePath: string | null }> {
	return request<T>(path, { method: 'GET', queryParams });
}

export async function post<T = unknown>(
	path: string,
	body?: Record<string, unknown>,
	queryParams?: Record<string, string>,
): Promise<{ data: T; rawResponsePath: string | null }> {
	return request<T>(path, { method: 'POST', body, queryParams });
}

export async function put<T = unknown>(
	path: string,
	body?: Record<string, unknown>,
	queryParams?: Record<string, string>,
): Promise<{ data: T; rawResponsePath: string | null }> {
	return request<T>(path, { method: 'PUT', body, queryParams });
}

export async function patch<T = unknown>(
	path: string,
	body?: Record<string, unknown>,
	queryParams?: Record<string, string>,
): Promise<{ data: T; rawResponsePath: string | null }> {
	return request<T>(path, { method: 'PATCH', body, queryParams });
}

export async function del<T = unknown>(
	path: string,
	queryParams?: Record<string, string>,
): Promise<{ data: T; rawResponsePath: string | null }> {
	return request<T>(path, { method: 'DELETE', queryParams });
}

export default {
	request,
	get,
	post,
	put,
	patch,
	del,
	validateTempoCredentials,
	normalizePath,
	appendQueryParams,
};
