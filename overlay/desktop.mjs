// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const product = JSON.parse(readFileSync('product.json', 'utf8'));
mkdirSync('.personal-build/dist', { recursive: true });
for (const suffix of ['', '-url-handler']) {
	let desktop = readFileSync(`resources/linux/code${suffix}.desktop`, 'utf8');
	for (const [key, value] of Object.entries({ NAME_LONG: product.nameLong, NAME_SHORT: product.nameShort, NAME: product.applicationName, EXEC: '/opt/code-personal/code-personal', ICON: product.linuxIconName, URLPROTOCOL: product.urlProtocol })) {
		 desktop = desktop.replaceAll(`@@${key}@@`, value);
	}
	// Electron 42 uses desktopName (without .desktop) for both WM_CLASS and Wayland app ID.
	desktop = desktop.replace(/^StartupWMClass=.*$/m, `StartupWMClass=${product.applicationName}`);
	if (/@@\w+@@/.test(desktop)) { throw new Error('Unresolved upstream desktop template token'); }
	const destination = `.personal-build/dist/code-personal${suffix}.desktop`;
	writeFileSync(destination, desktop);
	execFileSync('desktop-file-validate', [destination]);
}
