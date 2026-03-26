import { Logger } from './logger.util.js';
import { config } from './config.util.js';
import {
	createAuthInvalidError,
	createApiError,
	createUnexpectedError,
	createNotFoundError,
	McpError,
} from './error.util.js';
import { saveRawResponse } from './response.util.js';
import type { RequestOptions, TransportResponse } from './transport.util.js';

const transportLogger = Logger.forContext('utils/tempo.transport.util.ts');
transportLogger.debug('Tempo transport utility initialized');

/** Default Tempo Cloud REST API v4 base (no trailing slash). */
export const DEFAULT_TEMPO_API_BASE_URL = 'https://api.tempo.io/4';

export interface TempoCredentials {
	apiToken: string;
	baseUrl: string;
}

/**
 * Tempo Cloud user token (Settings → Data Access → API Integration) and optional base URL.
 */
export function getTempoCredentials(): TempoCredentials | null {
	const methodLogger = Logger.forContext(
		'utils/tempo.transport.util.ts',
		'getTempoCredentials',
	);

	const apiToken = config.get('TEMPO_API_TOKEN');
	const baseUrlRaw =
		config.get('TEMPO_API_BASE_URL') || DEFAULT_TEMPO_API_BASE_URL;

	if (!apiToken) {
		methodLogger.warn(
			'Missing Tempo credentials. Set TEMPO_API_TOKEN (and optionally TEMPO_API_BASE_URL).',
		);
		return null;
	}

	const baseUrl = baseUrlRaw.replace(/\/$/, '');
	methodLogger.debug('Using Tempo credentials');
	return { apiToken, baseUrl };
}

/**
 * Call Tempo REST API (Cloud v4 by default).
 */
export async function fetchTempo<T>(
	credentials: TempoCredentials,
	path: string,
	options: RequestOptions = {},
): Promise<TransportResponse<T>> {
	const methodLogger = Logger.forContext(
		'utils/tempo.transport.util.ts',
		'fetchTempo',
	);

	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const url = `${credentials.baseUrl}${normalizedPath}`;

	const headers = {
		Authorization: `Bearer ${credentials.apiToken}`,
		'Content-Type': 'application/json',
		Accept: 'application/json',
		...options.headers,
	};

	const requestOptions: RequestInit = {
		method: options.method || 'GET',
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined,
	};

	methodLogger.debug(`Calling Tempo API: ${url}`);

	const startTime = performance.now();

	try {
		const response = await fetch(url, requestOptions);
		const endTime = performance.now();
		const requestDuration = (endTime - startTime).toFixed(2);

		methodLogger.debug(
			`Raw response received: ${response.status} ${response.statusText}`,
			{
				url,
				status: response.status,
				statusText: response.statusText,
				headers: {
					contentType: response.headers.get('content-type'),
					contentLength: response.headers.get('content-length'),
				},
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			methodLogger.error(
				`Tempo API error: ${response.status} ${response.statusText}`,
				{ errorText, url, method: options.method || 'GET' },
			);

			let errorMessage = `${response.status} ${response.statusText}`;
			let parsedError: unknown = null;

			try {
				if (
					errorText &&
					(errorText.startsWith('{') || errorText.startsWith('['))
				) {
					parsedError = JSON.parse(errorText);

					const errorParts: string[] = [];
					const pe = parsedError as Record<string, unknown>;

					if (
						pe.errorMessages &&
						Array.isArray(pe.errorMessages) &&
						pe.errorMessages.length > 0
					) {
						errorParts.push((pe.errorMessages as string[]).join('; '));
					}

					if (
						pe.errors &&
						typeof pe.errors === 'object' &&
						!Array.isArray(pe.errors) &&
						Object.keys(pe.errors as object).length > 0
					) {
						const fieldErrors = Object.entries(pe.errors as object)
							.map(([key, value]) => `${key}: ${value}`)
							.join('; ');
						errorParts.push(fieldErrors);
					}

					if (pe.message && typeof pe.message === 'string') {
						errorParts.push(pe.message);
					}

					if (
						pe.errors &&
						Array.isArray(pe.errors) &&
						pe.errors.length > 0
					) {
						const atlassianError = (
							pe.errors as Array<{
								title?: string;
								detail?: string;
							}>
						)[0];
						if (atlassianError?.title) {
							errorParts.push(atlassianError.title);
						}
						if (atlassianError?.detail) {
							errorParts.push(atlassianError.detail);
						}
					}

					if (errorParts.length > 0) {
						errorMessage = errorParts.join(' | ');
					}
				}
			} catch {
				if (errorText && errorText.trim()) {
					errorMessage = errorText;
				}
			}

			if (response.status === 401) {
				throw createAuthInvalidError(
					`Authentication failed. Tempo API: ${errorMessage}`,
					parsedError || errorText,
				);
			} else if (response.status === 403) {
				throw createAuthInvalidError(
					`Insufficient permissions. Tempo API: ${errorMessage}`,
					parsedError || errorText,
				);
			} else if (response.status === 404) {
				throw createNotFoundError(
					`Resource not found. Tempo API: ${errorMessage}`,
					parsedError || errorText,
				);
			} else if (response.status === 429) {
				throw createApiError(
					`Rate limit exceeded. Tempo API: ${errorMessage}`,
					429,
					parsedError || errorText,
				);
			} else if (response.status >= 500) {
				throw createApiError(
					`Tempo server error. Detail: ${errorMessage}`,
					response.status,
					parsedError || errorText,
				);
			} else {
				const requestPath = path.split('?')[0];
				throw createApiError(
					`Tempo API request failed. Path: ${requestPath}. Detail: ${errorMessage}`,
					response.status,
					parsedError || errorText,
				);
			}
		}

		if (response.status === 204) {
			methodLogger.debug('Received 204 No Content response');
			return { data: {} as T, rawResponsePath: null };
		}

		const responseText = await response.text();
		if (!responseText || responseText.trim() === '') {
			methodLogger.debug('Received empty response body');
			return { data: {} as T, rawResponsePath: null };
		}

		try {
			const responseJson = JSON.parse(responseText);
			methodLogger.debug(`Response body:`, responseJson);

			const rawResponsePath = saveRawResponse(
				url,
				requestOptions.method || 'GET',
				options.body,
				responseJson,
				response.status,
				parseFloat(requestDuration),
			);

			return { data: responseJson as T, rawResponsePath };
		} catch {
			methodLogger.debug(
				`Could not parse response as JSON, returning raw content`,
			);
			return {
				data: responseText as unknown as T,
				rawResponsePath: null,
			};
		}
	} catch (error) {
		methodLogger.error(`Tempo request failed`, error);

		if (error instanceof McpError) {
			throw error;
		}

		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw createApiError(
				`Network error connecting to Tempo API: ${error.message}`,
				500,
				error,
			);
		} else if (error instanceof SyntaxError) {
			throw createApiError(
				`Invalid response from Tempo API (parsing error): ${error.message}`,
				500,
				error,
			);
		}

		throw createUnexpectedError(
			`Unexpected error while calling Tempo API: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
}
