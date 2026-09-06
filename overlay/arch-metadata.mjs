// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const archive = process.argv[2];
if (!/^code-personal-[\d.]+-linux-x64\.tar\.gz$/.test(archive)) { throw new Error('Unexpected archive name'); }
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const revision = JSON.parse(readFileSync('.personal-build/build-info.json', 'utf8')).packageRevision;
if (!Number.isSafeInteger(revision) || revision < 1) { throw new Error('Invalid package revision'); }
for (const desktop of ['code-personal.desktop', 'code-personal-url-handler.desktop']) {
	copyFileSync(`.personal-build/dist/${desktop}`, `.personal-build/arch/${desktop}`);
}
copyFileSync('.personal-build/assets/code-personal.svg', '.personal-build/arch/code-personal.svg');
const files = [archive, 'code-personal.desktop', 'code-personal-url-handler.desktop', 'code-personal.svg'];
const checksums = files.map(file => `'${createHash('sha256').update(readFileSync(`.personal-build/arch/${file}`)).digest('hex')}'`).join(' ');
writeFileSync('.personal-build/arch/PKGBUILD', readFileSync('.personal-build/arch/PKGBUILD.in', 'utf8').replaceAll('@@VERSION@@', version).replaceAll('@@PKGREL@@', String(revision)).replaceAll('@@ARCHIVE@@', archive).replaceAll('@@CHECKSUMS@@', checksums));
