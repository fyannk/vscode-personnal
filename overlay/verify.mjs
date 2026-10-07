// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import assert from 'node:assert/strict';
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createPublicKey } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { telemetryDefaults } from './telemetry-default.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, '../VSCode-linux-x64');
const app = path.join(output, 'resources/app');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const product = json(path.join(app, 'product.json'));
const overrides = json(path.join(root, '.personal-build/product-overrides.json'));
const buildInfo = json(path.join(root, '.personal-build/build-info.json'));
const baseline = json(path.join(root, '.personal-build/upstream.json'));
execFileSync('git', ['merge-base', '--is-ancestor', baseline.commit, 'HEAD'], { cwd: root });
const upstream = JSON.parse(execFileSync('git', ['show', `${baseline.commit}:product.json`], { cwd: root, encoding: 'utf8' }));
for (const [key, value] of Object.entries(overrides)) { assert.deepEqual(product[key], value, key); }
for (const [key, value] of Object.entries(upstream)) {
	if (!(key in overrides)) { assert.deepEqual(product[key], value, `Preserve upstream ${key}`); }
}
const pkg = json(path.join(app, 'package.json'));
assert.equal(pkg.name, 'Code Personal');
assert.equal(pkg.desktopName, 'code-personal.desktop');
assert.equal(product.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
assert.equal(product.serverDownloadUrlTemplate, `https://github.com/${buildInfo.remoteServerReleaseRepository}/releases/download/personal-v\${version}-r${buildInfo.packageRevision}/code-personal-server-\${version}-\${os}-\${arch}.tar.gz`);
for (const executable of ['code-personal', 'bin/code-personal']) { accessSync(path.join(output, executable), constants.X_OK); }
const remoteServer = path.resolve(root, '../CodePersonal-server-linux-x64');
accessSync(path.join(remoteServer, 'bin/code-personal-server'), constants.X_OK);
accessSync(path.join(remoteServer, 'out/server-main.js'));
assert.equal(json(path.join(remoteServer, 'product.json')).applicationName, 'code-personal');
assert.equal(json(path.join(remoteServer, 'product.json')).serverApplicationName, 'code-personal-server');
assert.deepEqual(readFileSync(path.join(app, 'resources/linux/code.png')), readFileSync(path.join(root, 'resources/linux/code.png')));
for (const icon of ['out/media/code-icon.svg', 'out/vs/workbench/browser/media/code-icon.svg']) {
	assert.deepEqual(readFileSync(path.join(app, icon)), readFileSync(path.join(root, '.personal-build/assets/code-personal.svg')), `Personal workbench icon: ${icon}`);
}
assert.notDeepEqual(readFileSync(path.join(app, 'resources/linux/code.png')), execFileSync('git', ['show', `${baseline.commit}:resources/linux/code.png`], { cwd: root }));
const copilotDir = path.join(app, 'extensions/copilot');
const copilot = json(path.join(copilotDir, 'package.json'));
assert.equal(`${copilot.publisher}.${copilot.name}`, product.defaultChatAgent.chatExtensionId);
const entry = path.resolve(copilotDir, copilot.main);
assert.ok([entry, `${entry}.js`].some(file => existsSync(file) && statSync(file).size > 0), 'Copilot entry point');
assert.ok(copilot.enabledApiProposals.length > 0, 'Copilot proposed APIs');
accessSync(path.join(app, 'extensions/github-authentication/package.json'));
const remoteSSHDir = path.join(app, 'extensions/code-personal.remote-ssh');
const remoteSSH = json(path.join(remoteSSHDir, 'package.json'));
assert.equal(`${remoteSSH.publisher}.${remoteSSH.name}`, 'code-personal.code-personal-remote-ssh');
assert.equal(remoteSSH.displayName, 'Code Personal Remote - SSH');
accessSync(path.join(remoteSSHDir, 'lib/extension.js'));
accessSync(path.join(remoteSSHDir, 'src/scripts/server-setup.sh'));
assert.match(readFileSync(path.join(remoteSSHDir, 'lib/extension.js'), 'utf8'), /No Code Personal server download URL is configured/);
// 1.139 moved the agent-host runtime from @github/copilot-linux-x64 to @github/copilot-sdk-linux-x64.
const runtimes = ['@github/copilot-sdk-linux-x64', '@github/copilot-linux-x64'].map(name => path.join(app, 'node_modules.asar.unpacked', name)).filter(dir => existsSync(dir));
assert.equal(runtimes.length, 1, `Exactly one bundled Copilot runtime package, found ${runtimes.join(', ') || 'none'}`);
const [runtime] = runtimes;
// The main process and the workbench both register the user setting and must carry the
// patched default. Since 1.140 out/main.js is only a bootstrap: out/mainImpl.js imports the
// main process from out/vs/code/electron-main/main.js. Accept any of these layouts, and
// sweep every shipped script so no other registration keeps a different default.
const out = path.join(app, 'out');
const scripts = readdirSync(out, { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.js')).map(file => path.join(out, file));
const registrations = new Map(scripts.map(file => [file, telemetryDefaults(readFileSync(file, 'utf8'))]).filter(([, defaults]) => defaults.length > 0));
for (const [file, defaults] of registrations) {
	assert.ok(defaults.every(level => level === 'off'), `telemetry.telemetryLevel default in ${file}: expected off, found ${JSON.stringify(defaults)}`);
}
const registered = paths => paths.map(file => path.join(out, file)).some(file => registrations.has(file));
const found = JSON.stringify([...registrations.keys()].map(file => path.relative(out, file)));
assert.ok(registered(['vs/code/electron-main/main.js', 'mainImpl.js', 'main.js']), `telemetry.telemetryLevel registration in the main process bundle, found in ${found}`);
assert.ok(registered(['vs/workbench/workbench.desktop.main.js']), `telemetry.telemetryLevel registration in the workbench bundle, found in ${found}`);
// The remote agent does not register the desktop setting schema; its launcher
// explicitly disables telemetry instead.
assert.match(readFileSync(path.join(remoteSSHDir, 'src/scripts/server-setup.sh'), 'utf8'), /--telemetry-level off/);
accessSync(path.join(runtime, 'package.json'));
accessSync(path.join(runtime, 'prebuilds/linux-x64/runtime.node'));
accessSync(path.join(runtime, 'ripgrep/bin/linux-x64/rg'), constants.X_OK);
accessSync(path.join(copilotDir, 'dist/copilotCLIShim.js'));
// The built-in extension's own SDK copy: its JavaScript survives packaging only with the
// customized build/.moduleignore; the native module and ripgrep are materialized afterwards.
const extensionSdk = path.join(copilotDir, 'node_modules/@github/copilot/sdk');
accessSync(path.join(extensionSdk, 'index.js'));
accessSync(path.join(extensionSdk, 'prebuilds/linux-x64/runtime.node'));
accessSync(path.join(extensionSdk, 'ripgrep/bin/linux-x64/rg'), constants.X_OK);
for (const application of [app, remoteServer]) {
	const verifierDir = path.join(application, 'node_modules/@vscode/vsce-sign');
	assert.equal(json(path.join(verifierDir, 'package.json')).codePersonalVerifier, 'node-ovsx-sign@1.2.0');
	const bundledKey = json(path.join(verifierDir, 'package.json')).codePersonalPublicKey;
	assert.match(bundledKey?.source ?? '', /^https:\/\/open-vsx\.org\//, 'Bundled Open VSX signing key source');
	createPublicKey(readFileSync(path.join(verifierDir, bundledKey.file), 'utf8'));
	assert.equal(typeof (await import(pathToFileURL(path.join(verifierDir, 'index.cjs')).href)).verify, 'function');
	accessSync(path.join(verifierDir, 'ThirdPartyNotices.txt'));
}
// Exercise package resolution using the remote server's own Node runtime.
execFileSync(path.join(remoteServer, 'node'), ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import { verify } from "@vscode/vsce-sign"; assert.equal(typeof verify, "function");'], { cwd: remoteServer });
const result = { version: pkg.version, commit: product.commit, output, remoteServer, identity: overrides, copilot: { id: `${copilot.publisher}.${copilot.name}`, version: copilot.version, main: copilot.main, runtime }, metadataAndPayloadChecks: 'passed', interactiveAuthentication: 'requires manual sign-in' };
mkdirSync(path.join(root, '.personal-build/logs'), { recursive: true });
writeFileSync(path.join(root, '.personal-build/logs/verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
