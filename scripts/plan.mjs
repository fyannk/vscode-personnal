import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function plan(api, repository, requested, revision, publish) {
	if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) { throw new Error('Invalid GitHub repository'); }
	if (!Number.isSafeInteger(revision) || revision < 1) { throw new Error('Invalid package revision'); }
	if (requested !== 'latest' && !/^\d+\.\d+\.\d+$/.test(requested)) { throw new Error('Use latest or a stable numeric VS Code tag'); }
	const release = await api(`repos/microsoft/vscode/releases/${requested === 'latest' ? 'latest' : `tags/${requested}`}`);
	if (release.draft || release.prerelease || !/^\d+\.\d+\.\d+$/.test(release.tag_name)) { throw new Error('Not a stable upstream release'); }
	const tag = release.tag_name;
	let object = (await api(`repos/microsoft/vscode/git/ref/tags/${tag}`)).object;
	for (let depth = 0; object.type === 'tag' && depth < 5; depth++) {
		object = (await api(`repos/microsoft/vscode/git/tags/${object.sha}`)).object;
	}
	if (object.type !== 'commit' || !/^[a-f0-9]{40}$/.test(object.sha)) { throw new Error('Cannot resolve upstream tag to a commit'); }
	const releaseTag = `personal-v${tag}-r${revision}`;
	const existing = await api(`repos/${repository}/releases/tags/${releaseTag}`, true);
	return { tag, commit: object.sha, releaseTag, shouldBuild: !publish || !existing || existing.draft === true, publish };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const config = JSON.parse(readFileSync('config.json', 'utf8'));
	const api = async (endpoint, allowMissing = false) => {
		const response = await fetch(`https://api.github.com/${endpoint}`, {
			headers: { Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) },
			signal: AbortSignal.timeout(30000)
		});
		if (allowMissing && response.status === 404) { return null; }
		if (!response.ok) { throw new Error(`GitHub API ${response.status}: ${endpoint}`); }
		return response.json();
	};
	const result = await plan(api, process.env.GITHUB_REPOSITORY, process.env.REQUESTED_TAG || 'latest', config.packageRevision, process.env.PUBLISH !== 'false');
	if (process.env.GITHUB_OUTPUT) {
		for (const [key, value] of Object.entries(result)) { appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`); }
	}
	console.log(JSON.stringify(result, null, 2));
}
