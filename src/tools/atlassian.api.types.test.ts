import {
	GetApiToolArgs,
	RequestWithBodyArgs,
} from './atlassian.api.types.js';

describe('Atlassian API tool schemas', () => {
	it('accepts profile as an optional field for read requests', () => {
		const result = GetApiToolArgs.parse({
			profile: 'client-a',
			path: '/rest/api/3/project/search',
			queryParams: { maxResults: '1' },
		});

		expect(result.profile).toBe('client-a');
		expect(result.path).toBe('/rest/api/3/project/search');
	});

	it('accepts profile as an optional field for write requests', () => {
		const result = RequestWithBodyArgs.parse({
			profile: 'client-b',
			path: '/rest/api/3/issue',
			body: {
				fields: {
					summary: 'Example issue',
				},
			},
		});

		expect(result.profile).toBe('client-b');
		expect(result.body.fields).toEqual({ summary: 'Example issue' });
	});

	it('keeps profile optional for backward compatibility', () => {
		const result = GetApiToolArgs.parse({
			path: '/rest/api/3/project/search',
		});

		expect(result.profile).toBeUndefined();
	});
});
