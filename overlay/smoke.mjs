// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// Launch the packaged application with its natural PERSONAL storage paths.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync, existsSync, readdirSync, readlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logs = path.join(root, '.personal-build/logs');
mkdirSync(logs, { recursive: true });
const server = createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const env = { ...process.env, WAYLAND_DEBUG: 'client' };
for (const key of ['ELECTRON_RUN_AS_NODE', 'VSCODE_DEV', 'VSCODE_PORTABLE', 'VSCODE_APPDATA', 'VSCODE_EXTENSIONS', 'VSCODE_IPC_HOOK_CLI', 'VSCODE_SKIP_BUILTIN_EXTENSIONS']) { delete env[key]; }
const executable = path.resolve(root, '../VSCode-linux-x64/code-personal');
const fd = openSync(path.join(logs, 'launch.log'), 'w');
const ci = process.argv.includes('--ci');
assert.ok(!ci || process.env.CODE_PERSONAL_CONTAINER === '1', '--ci is only for the disposable build container');
const child = spawn(executable, ['--new-window', '--skip-welcome', '--skip-release-notes', `--remote-debugging-port=${port}`, '--verbose', ...(ci ? ['--no-sandbox', '--disable-gpu'] : [])], { env, stdio: ['ignore', fd, fd] });
closeSync(fd);
let browser;
try {
	let endpointReady = false;
	for (let attempt = 0; attempt < 90; attempt++) {
		if (child.exitCode !== null) { throw new Error(`Application exited ${child.exitCode}; see launch.log`); }
		try {
			const response = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (response.ok) { endpointReady = true; break; }
		} catch { /* Electron is still starting. */ }
		await delay(1000);
	}
	assert.ok(endpointReady, 'Electron CDP startup within 90 seconds');
	browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
	let page;
	for (let attempt = 0; attempt < 60; attempt++) {
		page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('workbench.html'));
		if (page) { break; }
		await delay(1000);
	}
	assert.ok(page, 'Workbench window exists');
	await page.locator('.monaco-workbench').waitFor({ timeout: 60000 });
	await delay(10000);
	const state = await page.evaluate(() => {
		const configuration = window.vscode.context.configuration();
		return { title: document.title, userDataDir: configuration.userDataDir, execPath: configuration.execPath, mainPid: configuration.mainPid, profile: configuration.profiles.profile, productName: configuration.product.nameShort, applicationName: configuration.product.applicationName, dataFolderName: configuration.product.dataFolderName, sharedDataFolderName: configuration.product.sharedDataFolderName, body: document.body.innerText.slice(0, 1800) };
	});
	assert.equal(state.productName, 'Code Personal');
	assert.equal(state.applicationName, 'code-personal');
	assert.equal(state.execPath, executable);
	const svg = await page.locator('.window-appicon').evaluate(async element => {
		const background = getComputedStyle(element).backgroundImage;
		const url = background.match(/^url\(["']?(.*?)["']?\)$/)[1];
		return (await fetch(url)).text();
	});
	assert.equal(svg, readFileSync(path.join(root, '.personal-build/assets/code-personal.svg'), 'utf8'));
	assert.equal(state.userDataDir, path.join(env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'Code Personal'));
	assert.ok(existsSync(path.join(homedir(), '.code-personal/extensions')), 'Natural extension storage created');
	assert.ok(existsSync(path.join(homedir(), '.code-personal-shared')), 'Natural shared storage created');
	const wayland = readFileSync(path.join(logs, 'launch.log'), 'utf8');
	const openFiles = new Set();
	const inspectProcess = pid => {
		try {
			for (const descriptor of readdirSync(`/proc/${pid}/fd`)) {
				try { openFiles.add(readlinkSync(`/proc/${pid}/fd/${descriptor}`)); } catch { /* Descriptor closed. */ }
			}
			for (const descendant of readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean)) { inspectProcess(descendant); }
		} catch { /* Process exited. */ }
	};
	inspectProcess(state.mainPid);
	const officialPaths = [path.join(homedir(), '.config/Code'), path.join(homedir(), '.vscode')];
	assert.deepEqual([...openFiles].filter(file => officialPaths.some(official => file === official || file.startsWith(`${official}/`))), [], 'No open WORK data/extension files in personal process tree');
	const appIds = [...new Set([...wayland.matchAll(/set_app_id\("([^"\n]+)"\)/g)].map(match => match[1]))];
	if (env.XDG_SESSION_TYPE === 'wayland') { assert.ok(appIds.includes('code-personal'), 'Actual Wayland app ID'); }
	await page.screenshot({ path: path.join(logs, 'workbench.png') });
	const report = { ...state, waylandAppIds: appIds, extensionStorage: path.join(homedir(), '.code-personal/extensions'), sharedStorage: path.join(homedir(), '.code-personal-shared'), openPersonalStorage: [...openFiles].filter(file => file.startsWith(state.userDataDir) || file.startsWith(path.join(homedir(), '.code-personal'))).sort(), workFilesOpenAtInspection: 0, result: 'passed' };
	writeFileSync(path.join(logs, 'smoke.json'), JSON.stringify(report, null, 2) + '\n');
	console.log(JSON.stringify(report, null, 2));
} finally {
	await browser?.close();
	if (child.exitCode === null) { child.kill('SIGTERM'); }
}
