// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import assert from 'node:assert/strict';
import { accessSync, constants, existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const runtime = path.join(app, 'node_modules.asar.unpacked/@github/copilot-linux-x64');
// Each bundle registering the setting must carry the patched default.
for (const bundle of [path.join(app, 'out/main.js'), path.join(app, 'out/vs/workbench/workbench.desktop.main.js'), path.join(remoteServer, 'out/server-main.js')]) {
	const match = readFileSync(bundle, 'utf8').match(/\[TELEMETRY_SETTING_ID\]: \{[^]*?"default": "(\w+)"/);
	assert.equal(match?.[1], 'off', `telemetry.telemetryLevel default in ${bundle}`);
}
accessSync(path.join(runtime, 'package.json'));
accessSync(path.join(runtime, 'prebuilds/linux-x64/runtime.node'));
accessSync(path.join(runtime, 'ripgrep/bin/linux-x64/rg'), constants.X_OK);
accessSync(path.join(copilotDir, 'dist/copilotCLIShim.js'));
for (const application of [app, remoteServer]) {
	const verifierDir = path.join(application, 'node_modules/@vscode/vsce-sign');
	assert.equal(json(path.join(verifierDir, 'package.json')).codePersonalVerifier, 'node-ovsx-sign@1.2.0');
	assert.equal(typeof (await import(pathToFileURL(path.join(verifierDir, 'index.cjs')).href)).verify, 'function');
	accessSync(path.join(verifierDir, 'ThirdPartyNotices.txt'));
}
// Exercise package resolution using the remote server's own Node runtime.
execFileSync(path.join(remoteServer, 'node'), ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import { verify } from "@vscode/vsce-sign"; assert.equal(typeof verify, "function");'], { cwd: remoteServer });
const result = { version: pkg.version, commit: product.commit, output, remoteServer, identity: overrides, copilot: { id: `${copilot.publisher}.${copilot.name}`, version: copilot.version, main: copilot.main, runtime }, metadataAndPayloadChecks: 'passed', interactiveAuthentication: 'requires manual sign-in' };
mkdirSync(path.join(root, '.personal-build/logs'), { recursive: true });
writeFileSync(path.join(root, '.personal-build/logs/verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
