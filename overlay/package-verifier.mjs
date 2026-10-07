// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// esbuild is a declared upstream build dependency, not a root dependency.
const { build } = createRequire(path.join(root, 'build/package.json'))('esbuild');
const verifier = path.join(root, '.personal-build/verifier');
const info = JSON.parse(readFileSync(path.join(root, '.personal-build/build-info.json'), 'utf8'));
// Keep the extra locked dependency tree out of upstream's package.json/lockfile.
if (process.argv.includes('--install') || !existsSync(path.join(verifier, 'node_modules/node-ovsx-sign'))) {
	execFileSync('npm', ['ci', '--prefix', verifier, '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'inherit' });
}
const destination = path.resolve(root, '../VSCode-linux-x64/resources/app/node_modules/@vscode/vsce-sign');
mkdirSync(destination, { recursive: true });
const result = await build({
	entryPoints: [path.join(verifier, 'index.cjs')],
	bundle: true,
	platform: 'node',
	format: 'cjs',
	target: 'node22',
	outfile: path.join(destination, 'index.cjs'),
	metafile: true,
	write: false
});
// Atomic replacement allows an existing personal window to keep running.
writeFileSync(path.join(destination, 'index.cjs.tmp'), result.outputFiles[0].contents);
renameSync(path.join(destination, 'index.cjs.tmp'), path.join(destination, 'index.cjs'));
// Bundle the registry's current signing key. node-ovsx-sign otherwise fetches it with
// plain node-fetch during every install, which bypasses VS Code's proxy settings and
// fails on hosts without a direct network path (the dialog then shows ENOTFOUND).
const [publisher, name] = info.galleryTestExtension.split('.');
const registry = 'https://open-vsx.org/';
const metadataResponse = await fetch(`${registry}api/${publisher}/${name}`);
assert.ok(metadataResponse.ok, `Open VSX metadata for ${info.galleryTestExtension}: ${metadataResponse.status}`);
const publicKeyUrl = (await metadataResponse.json()).files?.publicKey ?? `${registry}file/public.pem`;
assert.ok(publicKeyUrl.startsWith(registry), `Unexpected public key location ${publicKeyUrl}`);
const publicKeyResponse = await fetch(publicKeyUrl);
assert.ok(publicKeyResponse.ok, `Open VSX public key ${publicKeyUrl}: ${publicKeyResponse.status}`);
const publicKey = await publicKeyResponse.text();
createPublicKey(publicKey);
writeFileSync(path.join(destination, 'open-vsx-public.pem'), publicKey);
writeFileSync(path.join(destination, 'package.json'), JSON.stringify({
	name: '@vscode/vsce-sign', version: '0.0.0-code-personal', main: 'index.cjs',
	type: 'commonjs', private: true,
	codePersonalVerifier: 'node-ovsx-sign@1.2.0',
	codePersonalPublicKey: { file: 'open-vsx-public.pem', source: publicKeyUrl, sha256: createHash('sha256').update(publicKey).digest('hex') },
	description: 'Code Personal adapter for node-ovsx-sign 1.2.0; not Microsoft vsce-sign'
}, null, 2) + '\n');
// Preserve license notices for the dependency code that actually enters the bundle.
const packages = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
	let directory = path.dirname(path.resolve(input));
	while (directory !== path.dirname(directory)) {
		if (existsSync(path.join(directory, 'package.json'))) { packages.add(directory); break; }
		directory = path.dirname(directory);
	}
}
const notices = [];
for (const directory of [...packages].sort()) {
	const pkg = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
	const licenses = readdirSync(directory).filter(name => /^(license|licence|copying|notice)(\.|$)/i.test(name));
	const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
	notices.push(`${pkg.name}@${pkg.version} (${pkg.license || 'see notice'})\nSource: ${repository || pkg.homepage || 'see package registry'}\n${licenses.map(name => readFileSync(path.join(directory, name), 'utf8')).join('\n')}`);
}
writeFileSync(path.join(destination, 'ThirdPartyNotices.txt'), notices.join('\n\n----------------------------------------\n\n'));
console.log(`Packaged Open VSX verifier: ${result.outputFiles[0].contents.length} bytes, ${packages.size} dependency notices, signing key from ${publicKeyUrl}.`);
