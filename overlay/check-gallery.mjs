// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const info = JSON.parse(readFileSync(path.join(root, '.personal-build/build-info.json'), 'utf8'));
const output = path.resolve(root, '../VSCode-linux-x64');
const logs = path.join(root, '.personal-build/logs');
const temporary = mkdtempSync(path.join(logs, 'gallery-test-'));
const env = { ...process.env };
for (const key of ['VSCODE_DEV', 'VSCODE_PORTABLE', 'VSCODE_APPDATA', 'VSCODE_EXTENSIONS', 'VSCODE_IPC_HOOK_CLI', 'ELECTRON_RUN_AS_NODE']) { delete env[key]; }
const extension = info.galleryTestExtension;
assert.match(extension, /^[a-z0-9-]+\.[a-z0-9-]+$/i);
try {
	const cli = execFileSync(path.join(output, 'bin/code-personal'), [
		`--user-data-dir=${temporary}/data`, `--extensions-dir=${temporary}/extensions`,
		`--shared-data-dir=${temporary}/shared`, '--install-extension', extension, '--log', 'trace'
	], { env, encoding: 'utf8', timeout: 300000, maxBuffer: 20 * 1024 * 1024 });
	writeFileSync(path.join(logs, 'gallery-install.log'), cli);
	assert.match(cli, /Success\. Executed: true/, 'The packaged gallery installation must execute signature verification');
	const installed = JSON.parse(readFileSync(path.join(temporary, 'extensions/extensions.json'), 'utf8'));
	const record = installed.find(item => item.identifier.id.toLowerCase() === extension.toLowerCase());
	assert.ok(record, 'Test extension installed');
	const version = record.version;
	const [publisher, name] = extension.split('.');
	const response = await fetch(`https://open-vsx.org/api/${publisher}/${name}/${version}`);
	assert.ok(response.ok);
	const metadata = await response.json();
	for (const [key, filename] of [['download', 'original.vsix'], ['signature', 'original.sigzip']]) {
		const file = await fetch(metadata.files[key]);
		assert.ok(file.ok);
		writeFileSync(path.join(temporary, filename), Buffer.from(await file.arrayBuffer()));
	}
	const { verify } = await import(pathToFileURL(path.join(output, 'resources/app/node_modules/@vscode/vsce-sign/index.cjs')).href);
	const original = path.join(temporary, 'original.vsix');
	const signature = path.join(temporary, 'original.sigzip');
	const valid = await verify(original, signature);
	assert.equal(valid.code, 'Success');
	// Change only the ZIP comment so parsing still succeeds and the cryptographic check rejects it.
	execFileSync('python3', ['-c', 'import shutil,sys,zipfile; shutil.copyfile(sys.argv[1],sys.argv[2]); z=zipfile.ZipFile(sys.argv[2],"a"); z.comment=b"tampered"; z.close()', original, path.join(temporary, 'tampered.vsix')]);
	const tampered = await verify(path.join(temporary, 'tampered.vsix'), signature);
	assert.notEqual(tampered.code, 'Success');
	assert.equal(tampered.didExecute, true);
	writeFileSync(path.join(logs, 'gallery-verification.json'), JSON.stringify({ extension, version, valid, tampered, galleryInstall: 'passed', result: 'passed' }, null, 2) + '\n');
	console.log('Gallery installation and valid/tampered signature checks passed.');
} catch (error) {
	if (error.stdout) { writeFileSync(path.join(logs, 'gallery-install.log'), error.stdout); }
	throw error;
} finally {
	// Only the disposable test profile is removed; preserve its CLI log above.
	rmSync(temporary, { recursive: true, force: true });
}
