import assert from 'node:assert/strict';
import test from 'node:test';
import { plan } from '../scripts/plan.mjs';

const commit = 'a'.repeat(40);
function fixture({ existing = null, prerelease = false, annotated = false, fail = false } = {}) {
	return async endpoint => {
		if (fail) { throw new Error('GitHub API unavailable'); }
		if (endpoint.includes('microsoft/vscode/releases/')) { return { tag_name: '1.136.1', draft: false, prerelease }; }
		if (endpoint.includes('/git/ref/')) { return { object: { type: annotated ? 'tag' : 'commit', sha: commit } }; }
		if (endpoint.includes('/git/tags/')) { return { object: { type: 'commit', sha: commit } }; }
		return existing;
	};
}
test('new stable release resolves annotated tag and requests a build', async () => {
	assert.deepEqual(await plan(fixture({ annotated: true }), 'owner/personal', 'latest', 3, true), {
		tag: '1.136.1', commit, releaseTag: 'personal-v1.136.1-r3', shouldBuild: true, publish: true
	});
});
test('published release is skipped; interrupted draft is retried', async () => {
	assert.equal((await plan(fixture({ existing: { draft: false } }), 'o/r', 'latest', 3, true)).shouldBuild, false);
	assert.equal((await plan(fixture({ existing: { draft: true } }), 'o/r', 'latest', 3, true)).shouldBuild, true);
});
test('manual verification can rebuild an already published version without publishing', async () => {
	assert.equal((await plan(fixture({ existing: { draft: false } }), 'o/r', '1.136.1', 3, false)).shouldBuild, true);
});
test('prerelease, unsafe tag, malformed revision, and API failures stop the workflow', async () => {
	await assert.rejects(plan(fixture({ prerelease: true }), 'o/r', 'latest', 3, true));
	await assert.rejects(plan(fixture(), 'o/r', '1.2.3\nevil', 3, true));
	await assert.rejects(plan(fixture(), 'o/r', 'latest', 0, true));
	await assert.rejects(plan(fixture({ fail: true }), 'o/r', 'latest', 3, true));
});
