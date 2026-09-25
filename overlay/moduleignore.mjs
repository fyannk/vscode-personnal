// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// VS Code 1.139 stopped depending on @github/copilot at the application root and
// replaced its targeted build/.moduleignore rules with a blanket `@github/copilot/**`.
// The same rule file also filters the built-in Copilot extension's production
// dependencies when Copilot is compiled from source, so the blanket rule strips the
// SDK that the extension's postinstall materializes under
// node_modules/@github/copilot/sdk, and packaging then fails in
// prepareBuiltInCopilotRipgrepShim. Upstream CI installs the extension as a prebuilt
// VSIX and never exercises this path. Restore the targeted rules for that package and
// keep the SDK entry point, which the VSIX build also ships.
export const blanketRule = '@github/copilot/**';
export const entryPointRule = '@github/copilot/sdk/index.js';
export const targetedRules = [
	'@github/copilot/prebuilds/**',
	'@github/copilot/clipboard/**',
	'@github/copilot/ripgrep/**',
	'@github/copilot/pvrecorder/**',
	'@github/copilot/foundry-local-sdk/**',
	'@github/copilot/mxc-bin/**',
	'@github/copilot/sharp/**',
	'@github/copilot/**/keytar.node',
];

export function patchModuleIgnore(text) {
	const lines = text.split(/\r?\n/);
	const rules = lines.map(line => line.trim());
	if (!rules.some(rule => rule.startsWith('@github/copilot/'))) {
		throw new Error('Reinspect upstream: build/.moduleignore no longer lists @github/copilot rules');
	}
	if (rules.filter(rule => rule === blanketRule).length > 1) {
		throw new Error(`Reinspect upstream: build/.moduleignore lists ${blanketRule} more than once`);
	}
	const patched = lines.flatMap((line, index) => {
		if (rules[index] === blanketRule) { return targetedRules; }
		if (rules[index] === entryPointRule) { return []; }
		return [line];
	});
	const result = patched.join('\n');
	return { text: result, patched: result !== text };
}
