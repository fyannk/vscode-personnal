// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// Run after installing the Debian package on Ubuntu, using its bundled Node ABI.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import path from 'node:path';

const application = path.resolve(process.argv[2] ?? '/opt/code-personal');
const executable = path.join(application, 'code-personal');
const addons = [
	path.join(application, 'resources/app/node_modules.asar.unpacked/@vscode/sqlite3/build/Release/vscode-sqlite3.node'),
	path.join(application, 'resources/app/node_modules.asar.unpacked/node-pty/build/Release/pty.node'),
];
accessSync(executable, constants.X_OK);
for (const addon of addons) {
	accessSync(addon);
	const result = spawnSync(executable, ['-e', 'require(process.argv[1])', addon], {
		env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
		encoding: 'utf8',
	});
	assert.equal(result.status, 0, `Failed to load ${addon}:\n${result.stderr || result.stdout}`);
}
console.log('Installed SQLite and PTY native modules loaded successfully.');
