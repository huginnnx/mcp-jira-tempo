import { Logger } from './logger.util.js';
import { config } from './config.util.js';
import {
	createAuthMissingError,
	createAuthInvalidError,
	createApiError,
	createUnexpectedError,
	createNotFoundError,
	McpError,
} from './error.util.js';
import { saveRawResponse } from './response.util.js';

// Create a contextualized logger for this file
const transportLogger = Logger.forContext('utils/transport.util.ts');

// Log transport utility initialization
transportLogger.debug('Transport utility initialized');

const ATLASSIAN_PROFILES_ENV_KEY = 'ATLASSIAN_PROFILES_JSON';
const ATLASSIAN_DEFAULT_PROFILE_ENV_KEY = 'ATLASSIAN_DEFAULT_PROFILE';

/**
 * Interface for Atlassian API credentials
 */
export interface AtlassianCredentials {
	siteName: string;
	userEmail: string;
	apiToken: string;
}

interface AtlassianProfileDefinition {
	siteName?: unknown;
	userEmail?: unknown;
	apiToken?: unknown;
}

interface AtlassianProfilesConfig {
	defaultProfile?: string;
	profiles: Record<string, AtlassianProfileDefinition>;
}

/**
 * Interface for HTTP request options
 */
export interface RequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	headers?: Record<string, string>;
	body?: unknown;
}

/**
 * Transport response wrapper that includes the data and the path to the raw response file
 */
export interface TransportResponse<T> {
	data: T;
	rawResponsePath: string | null;
}

/**
 * Get Atlassian credentials from environment variables
 * @returns AtlassianCredentials object or null if credentials are missing
 */
function getLegacyAtlassianCredentials(): AtlassianCredentials | null {
	const siteName = config.get('ATLASSIAN_SITE_NAME');
	const userEmail = config.get('ATLASSIAN_USER_EMAIL');
	const apiToken = config.get('ATLASSIAN_API_TOKEN');

	if (!siteName || !userEmail || !apiToken) {
		return null;
	}

	return {
		siteName,
		userEmail,
		apiToken,
	};
}

function getConfiguredAtlassianProfiles(): AtlassianProfilesConfig | null {
	const rawProfiles = config.get(ATLASSIAN_PROFILES_ENV_KEY);
	if (!rawProfiles) {
		return null;
	}

	try {
		const parsed = JSON.parse(rawProfiles);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('Expected a JSON object keyed by profile name');
		}

		return {
			defaultProfile: config.get(ATLASSIAN_DEFAULT_PROFILE_ENV_KEY),
			profiles: parsed as Record<string, AtlassianProfileDefinition>,
		};
	} catch (error) {
		throw createAuthInvalidError(
			`Invalid ${ATLASSIAN_PROFILES_ENV_KEY}. Expected a JSON object keyed by profile name.`,
			error,
		);
	}
}

function describeAvailableProfiles(profileNames: string[]): string {
	return profileNames.length > 0
		? ` Available profiles: ${profileNames.join(', ')}.`
		: ' No Jira profiles are currently configured.';
}

function validateConfiguredProfile(
	profileName: string,
	profile: AtlassianProfileDefinition | undefined,
): AtlassianCredentials {
	if (!profile || typeof profile !== 'object') {
		throw createAuthInvalidError(
			`Unknown Jira profile "${profileName}". Review your Jira profile configuration.`,
		);
	}

	const siteName =
		typeof profile.siteName === 'string' ? profile.siteName.trim() : '';
	const userEmail =
		typeof profile.userEmail === 'string' ? profile.userEmail.trim() : '';
	const apiToken =
		typeof profile.apiToken === 'string' ? profile.apiToken.trim() : '';

	if (!siteName || !userEmail || !apiToken) {
		throw createAuthInvalidError(
			`Invalid Jira profile "${profileName}". Each profile must include siteName, userEmail, and apiToken.`,
		);
	}

	return { siteName, userEmail, apiToken };
}

export function getAtlassianCredentials(
	profileName?: string,
): AtlassianCredentials | null {
	const methodLogger = Logger.forContext(
		'utils/transport.util.ts',
		'getAtlassianCredentials',
	);

	const profilesConfig = getConfiguredAtlassianProfiles();
	const availableProfiles = Object.keys(profilesConfig?.profiles || {}).sort();
	const requestedProfile = profileName?.trim();

	if (requestedProfile) {
		const profile = profilesConfig?.profiles[requestedProfile];
		if (!profile) {
			throw createAuthInvalidError(
				`Unknown Jira profile "${requestedProfile}". Review your Jira profile configuration.${describeAvailableProfiles(availableProfiles)}`,
			);
		}

		methodLogger.debug(`Using Jira profile "${requestedProfile}"`);
		return validateConfiguredProfile(requestedProfile, profile);
	}

	if (profilesConfig?.defaultProfile) {
		const defaultProfile = profilesConfig.defaultProfile.trim();
		const profile = profilesConfig.profiles[defaultProfile];
		if (!profile) {
			throw createAuthInvalidError(
				`Default Jira profile "${defaultProfile}" is not configured.${describeAvailableProfiles(availableProfiles)}`,
			);
		}

		methodLogger.debug(`Using default Jira profile "${defaultProfile}"`);
		return validateConfiguredProfile(defaultProfile, profile);
	}

	const legacyCredentials = getLegacyAtlassianCredentials();
	if (legacyCredentials) {
		methodLogger.debug('Using legacy Atlassian credentials');
		return legacyCredentials;
	}

	if (availableProfiles.length > 0) {
		throw createAuthMissingError(
			`Jira profiles are configured but no default profile was set. Specify a profile in the request or configure ${ATLASSIAN_DEFAULT_PROFILE_ENV_KEY}.${describeAvailableProfiles(availableProfiles)}`,
		);
	}

	if (!legacyCredentials) {
		methodLogger.warn(
			'Missing Atlassian credentials. Please set ATLASSIAN_SITE_NAME, ATLASSIAN_USER_EMAIL, and ATLASSIAN_API_TOKEN environment variables.',
		);
		return null;
	}

	return legacyCredentials;
}

/**
 * Fetch data from Atlassian API
 * @param credentials Atlassian API credentials
 * @param path API endpoint path (without base URL)
 * @param options Request options
 * @returns Transport response with data and raw response path
 */
export async function fetchAtlassian<T>(
	credentials: AtlassianCredentials,
	path: string,
	options: RequestOptions = {},
): Promise<TransportResponse<T>> {
	const methodLogger = Logger.forContext(
		'utils/transport.util.ts',
		'fetchAtlassian',
	);

	const { siteName, userEmail, apiToken } = credentials;

	// Ensure path starts with a slash
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;

	// Construct the full URL
	const baseUrl = `https://${siteName}.atlassian.net`;
	const url = `${baseUrl}${normalizedPath}`;

	// Set up authentication and headers
	const headers = {
		Authorization: `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString('base64')}`,
		'Content-Type': 'application/json',
		Accept: 'application/json',
		...options.headers,
	};

	// Prepare request options
	const requestOptions: RequestInit = {
		method: options.method || 'GET',
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined,
	};

	methodLogger.debug(`Calling Atlassian API: ${url}`);

	// Track API call performance
	const startTime = performance.now();

	try {
		const response = await fetch(url, requestOptions);
		const endTime = performance.now();
		const requestDuration = (endTime - startTime).toFixed(2);

		// Log the raw response status and headers
		methodLogger.debug(
			`Raw response received: ${response.status} ${response.statusText}`,
			{
				url,
				status: response.status,
				statusText: response.statusText,
				// Just log a simplified representation of headers
				headers: {
					contentType: response.headers.get('content-type'),
					contentLength: response.headers.get('content-length'),
				},
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			methodLogger.error(
				`API error: ${response.status} ${response.statusText}`,
				{ errorText, url, method: options.method || 'GET' },
			);

			// Try to parse the error response - handle Jira-specific error formats
			let errorMessage = `${response.status} ${response.statusText}`;
			let parsedError = null;

			try {
				if (
					errorText &&
					(errorText.startsWith('{') || errorText.startsWith('['))
				) {
					parsedError = JSON.parse(errorText);

					// Process the parsed error object to build a comprehensive error message
					const errorParts: string[] = [];

					// Jira-specific error format: errorMessages array
					if (
						parsedError.errorMessages &&
						Array.isArray(parsedError.errorMessages) &&
						parsedError.errorMessages.length > 0
					) {
						// Format: {"errorMessages":["Issue does not exist or you do not have permission to see it."],"errors":{}}
						errorParts.push(parsedError.errorMessages.join('; '));
					}

					// Jira-specific error format: errors object with field-specific errors
					if (
						parsedError.errors &&
						typeof parsedError.errors === 'object' &&
						Object.keys(parsedError.errors).length > 0
					) {
						// Format: { "errors": { "jql": "The JQL query is invalid." }, "errorMessages": [], "warningMessages": [] }
						const fieldErrors = Object.entries(parsedError.errors)
							.map(([key, value]) => `${key}: ${value}`)
							.join('; ');
						errorParts.push(fieldErrors);
					}

					// Generic Atlassian API error with a message field
					if (parsedError.message) {
						// Format: {"message":"Some error message"}
						errorParts.push(parsedError.message);
					}

					// Other Atlassian API error formats (generic)
					if (
						parsedError.errors &&
						Array.isArray(parsedError.errors) &&
						parsedError.errors.length > 0
					) {
						// Format: {"errors":[{"status":400,"code":"INVALID_REQUEST_PARAMETER","title":"..."}]}
						const atlassianError = parsedError.errors[0];
						if (atlassianError.title) {
							errorParts.push(atlassianError.title);
						}
						if (atlassianError.detail) {
							errorParts.push(atlassianError.detail);
						}
					}

					// Check for warnings that might give additional context
					if (
						parsedError.warningMessages &&
						Array.isArray(parsedError.warningMessages) &&
						parsedError.warningMessages.length > 0
					) {
						errorParts.push(
							`Warnings: ${parsedError.warningMessages.join('; ')}`,
						);
					}

					// Combine all error parts into a single message
					if (errorParts.length > 0) {
						errorMessage = errorParts.join(' | ');
					}
				}
			} catch (parseError) {
				methodLogger.debug(`Error parsing error response:`, parseError);
				// Fall back to using the raw error text
				if (errorText && errorText.trim()) {
					errorMessage = errorText;
				}
			}

			// Classify HTTP errors based on status code
			if (response.status === 401) {
				throw createAuthInvalidError(
					`Authentication failed. Jira API: ${errorMessage}`,
					parsedError || errorText,
				);
			} else if (response.status === 403) {
				throw createAuthInvalidError(
					`Insufficient permissions. Jira API: ${errorMessage}`,
					parsedError || errorText,
				);
			} else if (response.status === 404) {
				throw createNotFoundError(
					`Resource not found. Jira API: ${errorMessage}`,
					parsedError || errorText,
				);
			} else if (response.status === 429) {
				throw createApiError(
					`Rate limit exceeded. Jira API: ${errorMessage}`,
					429,
					parsedError || errorText,
				);
			} else if (response.status >= 500) {
				throw createApiError(
					`Jira server error. Detail: ${errorMessage}`,
					response.status,
					parsedError || errorText,
				);
			} else {
				// For other API errors, create detailed error with context
				const requestPath = path.split('?')[0]; // Remove query parameters for cleaner logs
				let contextualInfo = '';

				// Add some contextual handling for common operations
				if (
					requestPath.includes('/search') &&
					parsedError?.errors?.jql
				) {
					contextualInfo = ' Check your JQL syntax for errors.';
				} else if (
					requestPath.includes('/issue/') &&
					options.method === 'POST'
				) {
					contextualInfo =
						' Check issue fields for validation errors.';
				}

				throw createApiError(
					`Jira API request failed. Detail: ${errorMessage}${contextualInfo}`,
					response.status,
					parsedError || errorText,
				);
			}
		}

		// Handle 204 No Content responses (common for DELETE operations)
		if (response.status === 204) {
			methodLogger.debug('Received 204 No Content response');
			return { data: {} as T, rawResponsePath: null };
		}

		// Handle empty responses (some endpoints return 200/201 with no body)
		const responseText = await response.text();
		if (!responseText || responseText.trim() === '') {
			methodLogger.debug('Received empty response body');
			return { data: {} as T, rawResponsePath: null };
		}

		// For JSON responses, parse the text we already read
		try {
			const responseJson = JSON.parse(responseText);
			methodLogger.debug(`Response body:`, responseJson);

			// Save raw response to file and capture the path
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
		methodLogger.error(`Request failed`, error);

		// If it's already an McpError, just rethrow it
		if (error instanceof McpError) {
			throw error;
		}

		// Handle network or parsing errors
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw createApiError(
				`Network error connecting to Jira API: ${error.message}`,
				500,
				error,
			);
		} else if (error instanceof SyntaxError) {
			throw createApiError(
				`Invalid response from Jira API (parsing error): ${error.message}`,
				500,
				error,
			);
		}

		throw createUnexpectedError(
			`Unexpected error while calling Jira API: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
}
