import assert from 'node:assert/strict';
import test from 'node:test';
import { blanketRule, entryPointRule, patchModuleIgnore, targetedRules } from '../overlay/moduleignore.mjs';

const since139 = [
	'# @github/copilot - strip unneeded binaries and files',
	'# Agent Host uses the runtime bundled with @github/copilot-sdk.',
	blanketRule,
	'',
	'@github/copilot-linux-x64/**',
	'@github/copilot-sdk/node_modules/@github/copilot/**',
	'',
].join('\n');
const before139 = [
	'# @github/copilot - strip unneeded binaries and files',
	entryPointRule,
	...targetedRules,
	'',
	'@github/copilot-linux-x64/**',
	'',
].join('\n');

test('the blanket rule from 1.139 becomes targeted rules that keep the extension SDK', () => {
	const { text, patched } = patchModuleIgnore(since139);
	assert.ok(patched);
	const rules = text.split('\n');
	assert.ok(!rules.includes(blanketRule));
	for (const rule of targetedRules) { assert.ok(rules.includes(rule), rule); }
	assert.ok(!rules.some(rule => rule.startsWith('@github/copilot/sdk')));
	assert.ok(rules.includes('@github/copilot-linux-x64/**'), 'unrelated rules survive');
	assert.ok(rules.includes('@github/copilot-sdk/node_modules/@github/copilot/**'), 'nested CLI rule survives');
	assert.equal(patchModuleIgnore(text).patched, false, 'idempotent');
});
test('older releases only lose the SDK entry-point rule', () => {
	const { text, patched } = patchModuleIgnore(before139);
	assert.ok(patched);
	assert.equal(text, before139.split('\n').filter(rule => rule !== entryPointRule).join('\n'));
});
test('an unrecognized rule set stops the build', () => {
	assert.throws(() => patchModuleIgnore('# nothing about copilot\n@vscode/ripgrep/bin/**\n'), /Reinspect upstream/);
	assert.throws(() => patchModuleIgnore(`${blanketRule}\n${blanketRule}\n`), /more than once/);
});
