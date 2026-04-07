import { request } from './vendor.atlassian.api.service.js';

const ORIGINAL_ENV = { ...process.env };

function setProfiles(): void {
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
}

describe('VendorAtlassianApiService', () => {
	beforeEach(() => {
		process.env = { ...ORIGINAL_ENV };
		delete process.env.ATLASSIAN_SITE_NAME;
		delete process.env.ATLASSIAN_USER_EMAIL;
		delete process.env.ATLASSIAN_API_TOKEN;
		delete process.env.ATLASSIAN_PROFILES_JSON;
		delete process.env.ATLASSIAN_DEFAULT_PROFILE;

		Object.defineProperty(global, 'fetch', {
			value: jest.fn().mockResolvedValue({
				ok: true,
				status: 204,
				statusText: 'No Content',
				headers: new Headers(),
			}),
			writable: true,
		});
	});

	afterAll(() => {
		process.env = ORIGINAL_ENV;
	});

	it('uses the explicitly requested profile for the Jira base URL', async () => {
		setProfiles();

		await request('/rest/api/3/project/search', {
			method: 'GET',
			profile: 'client-b',
		});

		expect(global.fetch).toHaveBeenCalledWith(
			'https://client-b.atlassian.net/rest/api/3/project/search',
			expect.any(Object),
		);
	});

	it('uses the default profile when the request omits profile', async () => {
		setProfiles();

		await request('/rest/api/3/project/search', {
			method: 'GET',
		});

		expect(global.fetch).toHaveBeenCalledWith(
			'https://client-a.atlassian.net/rest/api/3/project/search',
			expect.any(Object),
		);
	});

	it('fails before making a Jira call when the profile is unknown', async () => {
		setProfiles();

		await expect(
			request('/rest/api/3/project/search', {
				method: 'GET',
				profile: 'missing',
			}),
		).rejects.toThrow('Unknown Jira profile "missing"');

		expect(global.fetch).not.toHaveBeenCalled();
	});
});
