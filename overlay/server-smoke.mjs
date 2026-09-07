// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logs = path.join(root, '.personal-build/logs');
const server = path.resolve(root, '../CodePersonal-server-linux-x64/bin/code-personal-server');
const temporary = mkdtempSync(path.join(tmpdir(), 'code-personal-server-smoke-'));
const token = path.join(temporary, 'token');
writeFileSync(token, 'code-personal-server-smoke-token\n');
let output = '';
const child = spawn(server, ['--start-server', '--host=127.0.0.1', '--port=0', '--connection-token-file', token, '--telemetry-level', 'off', '--enable-remote-auto-shutdown', '--accept-server-license-terms']);
child.stdout.on('data', chunk => output += chunk);
child.stderr.on('data', chunk => output += chunk);
try {
	for (let attempt = 0; attempt < 40 && !/Extension host agent listening on \d+/.test(output); attempt++) {
		assert.equal(child.exitCode, null, output || 'Remote server exited before listening');
		await delay(500);
	}
	assert.match(output, /Extension host agent listening on \d+/);
	writeFileSync(path.join(logs, 'server-smoke.json'), JSON.stringify({ server, output, result: 'passed' }, null, 2) + '\n');
	console.log('Code Personal remote server smoke test passed.');
} finally {
	if (child.exitCode === null) { child.kill('SIGTERM'); }
	rmSync(temporary, { recursive: true, force: true });
}
