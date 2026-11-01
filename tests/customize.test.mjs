import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('customization enables Codex and marks source-built Copilot as production before compilation', t => {
	const root = mkdtempSync(path.join(tmpdir(), 'personal-customize-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const write = (file, text) => {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), text);
	};
	const json = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
	for (const file of ['customize.mjs', 'moduleignore.mjs', 'product-overrides.json']) {
		mkdirSync(path.join(root, '.personal-build'), { recursive: true });
		cpSync(new URL(`../overlay/${file}`, import.meta.url), path.join(root, '.personal-build', file));
	}
	write('product.json', JSON.stringify({ defaultChatAgent: { chatExtensionId: 'GitHub.copilot-chat' } }));
	write('.personal-build/build-info.json', JSON.stringify({ remoteServerReleaseRepository: 'test/releases', packageRevision: 10 }));
	write('extensions/copilot/package.json', JSON.stringify({ buildType: 'dev', version: '1.0.0' }));
	write('src/vs/platform/telemetry/common/telemetryService.ts', "'default': TelemetryConfiguration.ON,");
	write('build/.moduleignore', '@github/copilot/**\n');
	write('.personal-build/assets/code-personal.svg', '<svg/>');
	write('src/vs/workbench/browser/media/code-icon.svg', '<svg/>');
	for (const theme of ['dark', 'light', 'hcDark', 'hcLight']) {
		write(`.personal-build/assets/letterpress-${theme}.svg`, `<svg id="ermine-${theme}"/>`);
		write(`src/vs/workbench/browser/parts/editor/media/letterpress-${theme}.svg`, '<svg/>');
	}
	mkdirSync(path.join(root, 'resources/linux'), { recursive: true });
	// Only stub the external image converter; run the actual customization script.
	write('bin/rsvg-convert', '#!/bin/sh\ncp "$7" "$6"\n');
	chmodSync(path.join(root, 'bin/rsvg-convert'), 0o755);
	execFileSync(process.execPath, [path.join(root, '.personal-build/customize.mjs')], {
		env: { ...process.env, PATH: `${path.join(root, 'bin')}:${process.env.PATH}` },
	});
	assert.deepEqual(json('extensions/copilot/package.json'), { buildType: 'prod', version: '1.0.0' });
	assert.deepEqual(json('product.json').extensionEnabledApiProposals['openai.chatgpt'], ['chatSessionsProvider', 'languageModelProxy']);
	assert.deepEqual(json('product.json').defaultChatAgent, { chatExtensionId: 'GitHub.copilot-chat' });
	for (const theme of ['dark', 'light', 'hcDark', 'hcLight']) {
		assert.equal(readFileSync(path.join(root, `src/vs/workbench/browser/parts/editor/media/letterpress-${theme}.svg`), 'utf8'), `<svg id="ermine-${theme}"/>`);
	}
});
