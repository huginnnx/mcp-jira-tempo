import {
	fetchAtlassian,
	getAtlassianCredentials,
	type AtlassianCredentials,
} from './transport.util.js';

const ORIGINAL_ENV = { ...process.env };

function clearAtlassianEnv(): void {
	delete process.env.ATLASSIAN_SITE_NAME;
	delete process.env.ATLASSIAN_USER_EMAIL;
	delete process.env.ATLASSIAN_API_TOKEN;
	delete process.env.ATLASSIAN_PROFILES_JSON;
	delete process.env.ATLASSIAN_DEFAULT_PROFILE;
}

describe('Transport Utility', () => {
	beforeEach(() => {
		process.env = { ...ORIGINAL_ENV };
		clearAtlassianEnv();
		Object.defineProperty(global, 'fetch', {
			value: jest.fn(),
			writable: true,
		});
	});

	afterAll(() => {
		process.env = ORIGINAL_ENV;
	});

	describe('getAtlassianCredentials', () => {
		it('returns legacy credentials when only ATLASSIAN_* variables are set', () => {
			process.env.ATLASSIAN_SITE_NAME = 'legacy-site';
			process.env.ATLASSIAN_USER_EMAIL = 'legacy@example.com';
			process.env.ATLASSIAN_API_TOKEN = 'legacy-token';

			expect(getAtlassianCredentials()).toEqual({
				siteName: 'legacy-site',
				userEmail: 'legacy@example.com',
				apiToken: 'legacy-token',
			});
		});

		it('prefers the configured default profile over legacy credentials', () => {
			process.env.ATLASSIAN_SITE_NAME = 'legacy-site';
			process.env.ATLASSIAN_USER_EMAIL = 'legacy@example.com';
			process.env.ATLASSIAN_API_TOKEN = 'legacy-token';
			process.env.ATLASSIAN_DEFAULT_PROFILE = 'client-a';
			process.env.ATLASSIAN_PROFILES_JSON = JSON.stringify({
				'client-a': {
					siteName: 'client-a',
					userEmail: 'profile@example.com',
					apiToken: 'profile-token',
				},
			});

			expect(getAtlassianCredentials()).toEqual({
				siteName: 'client-a',
				userEmail: 'profile@example.com',
				apiToken: 'profile-token',
			});
		});

		it('returns explicitly requested profile credentials', () => {
			process.env.ATLASSIAN_DEFAULT_PROFILE = 'client-a';
			process.env.ATLASSIAN_PROFILES_JSON = JSON.stringify({
				'client-a': {
					siteName: 'client-a',
					userEmail: 'a@example.com',
					apiToken: 'token-a',
				},
				'client-b': {
					siteName: 'client-b',
					userEmail: 'b@example.com',
					apiToken: 'token-b',
				},
			});

			expect(getAtlassianCredentials('client-b')).toEqual({
				siteName: 'client-b',
				userEmail: 'b@example.com',
				apiToken: 'token-b',
			});
		});

		it('throws an actionable error for unknown profiles', () => {
			process.env.ATLASSIAN_PROFILES_JSON = JSON.stringify({
				'client-a': {
					siteName: 'client-a',
					userEmail: 'a@example.com',
					apiToken: 'token-a',
				},
			});

			expect(() => getAtlassianCredentials('missing')).toThrow(
				'Unknown Jira profile "missing"',
			);
		});

		it('throws when a configured profile is incomplete', () => {
			process.env.ATLASSIAN_DEFAULT_PROFILE = 'client-a';
			process.env.ATLASSIAN_PROFILES_JSON = JSON.stringify({
				'client-a': {
					siteName: 'client-a',
					userEmail: 'a@example.com',
				},
			});

			expect(() => getAtlassianCredentials()).toThrow(
				'Invalid Jira profile "client-a"',
			);
		});

		it('throws when profiles exist but no default is configured', () => {
			process.env.ATLASSIAN_PROFILES_JSON = JSON.stringify({
				'client-a': {
					siteName: 'client-a',
					userEmail: 'a@example.com',
					apiToken: 'token-a',
				},
			});

			expect(() => getAtlassianCredentials()).toThrow(
				'no default profile was set',
			);
		});

		it('returns null when neither profiles nor legacy credentials exist', () => {
			expect(getAtlassianCredentials()).toBeNull();
		});
	});

	describe('fetchAtlassian', () => {
		it('normalizes the request path and builds the Jira URL from credentials', async () => {
			const credentials: AtlassianCredentials = {
				siteName: 'client-a',
				userEmail: 'user@example.com',
				apiToken: 'secret-token',
			};

			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				status: 204,
				statusText: 'No Content',
				headers: new Headers(),
			});

			await fetchAtlassian(credentials, 'rest/api/3/project/search', {
				method: 'GET',
			});

			expect(global.fetch).toHaveBeenCalledWith(
				'https://client-a.atlassian.net/rest/api/3/project/search',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						Authorization: expect.stringContaining('Basic '),
					}),
				}),
			);
		});
	});
});
