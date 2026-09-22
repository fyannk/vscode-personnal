// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// Packages the verified application tree for Debian/Ubuntu with the same layout as the Arch package.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.umask(0o022);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, '../VSCode-linux-x64');
const overlay = path.join(root, '.personal-build');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const revision = JSON.parse(readFileSync(path.join(overlay, 'build-info.json'), 'utf8')).packageRevision;
if (!Number.isSafeInteger(revision) || revision < 1) { throw new Error('Invalid package revision'); }
// Upstream's dpkg-shlibdeps reference list, the Depends of its own .deb; the Arch container has no Debian sysroot to regenerate it.
const { referenceGeneratedDepsByArch, recommendedDeps } = await import(pathToFileURL(path.join(root, 'build/linux/debian/dep-lists.ts')));
const depends = [...new Set([...referenceGeneratedDepsByArch.amd64, 'libsecret-1-0', 'libgssapi-krb5-2'])];
assert.ok(depends.some(dep => dep.startsWith('libnss3')) && depends.some(dep => dep.startsWith('libgtk-3-0')), 'Upstream Debian dependency list');

const name = `code-personal_${version}-${revision}_amd64`;
const staging = path.join(overlay, 'deb', name);
rmSync(path.join(overlay, 'deb'), { recursive: true, force: true });
mkdirSync(path.join(staging, 'opt/code-personal'), { recursive: true });
mkdirSync(path.join(staging, 'usr/bin'), { recursive: true });
execFileSync('cp', ['-a', `${output}/.`, path.join(staging, 'opt/code-personal/')]);
symlinkSync('/opt/code-personal/bin/code-personal', path.join(staging, 'usr/bin/code-personal'));
// Chromium's upstream setuid sandbox, for systems without user namespaces.
chmodSync(path.join(staging, 'opt/code-personal/chrome-sandbox'), 0o4755);
const install = (source, destination) => {
	const target = path.join(staging, destination);
	mkdirSync(path.dirname(target), { recursive: true });
	copyFileSync(source, target);
	chmodSync(target, 0o644);
};
for (const desktop of ['code-personal.desktop', 'code-personal-url-handler.desktop']) { install(path.join(overlay, 'dist', desktop), `usr/share/applications/${desktop}`); }
install(path.join(overlay, 'assets/code-personal.svg'), 'usr/share/icons/hicolor/scalable/apps/code-personal.svg');
install(path.join(output, 'resources/app/resources/linux/code.png'), 'usr/share/icons/hicolor/512x512/apps/code-personal.png');
install(path.join(output, 'resources/app/LICENSE.txt'), 'usr/share/doc/code-personal/copyright');

const installedSize = execFileSync('du', ['-sk', staging], { encoding: 'utf8' }).split('\t')[0];
const control = readFileSync(path.join(overlay, 'debian/control.in'), 'utf8')
	.replaceAll('@@VERSION@@', `${version}-${revision}`)
	.replaceAll('@@DEPENDS@@', depends.join(', '))
	.replaceAll('@@RECOMMENDS@@', recommendedDeps.join(', '))
	.replaceAll('@@INSTALLEDSIZE@@', installedSize);
if (/@@\w+@@/.test(control)) { throw new Error('Unresolved control template token'); }
mkdirSync(path.join(staging, 'DEBIAN'));
writeFileSync(path.join(staging, 'DEBIAN/control'), control);
// Desktop, icon and MIME databases are refreshed by dpkg triggers; no maintainer scripts are needed.
const deb = path.join(overlay, 'dist', `${name}.deb`);
mkdirSync(path.dirname(deb), { recursive: true });
execFileSync('dpkg-deb', ['--root-owner-group', '-Zxz', `--threads-max=${availableParallelism()}`, '--build', staging, deb], { stdio: 'inherit' });
rmSync(path.join(overlay, 'deb'), { recursive: true, force: true });

const info = execFileSync('dpkg-deb', ['--info', deb], { encoding: 'utf8' });
// Recent VS Code payloads have a package listing larger than Node's 1 MiB default.
// Keep the captured listing bounded while allowing the complete ownership audit.
const contents = execFileSync('dpkg-deb', ['--contents', deb], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
mkdirSync(path.join(overlay, 'logs'), { recursive: true });
writeFileSync(path.join(overlay, 'logs/deb.log'), info + contents);
assert.match(info, /^ Package: code-personal$/m);
assert.match(info, new RegExp(`^ Version: ${version.replaceAll('.', '\\.')}-${revision}$`, 'm'));
assert.match(info, /^ Architecture: amd64$/m);
assert.match(contents, /^-rwsr-xr-x root\/root .* \.\/opt\/code-personal\/chrome-sandbox$/m, 'Setuid sandbox owned by root');
assert.match(contents, /^lrwxrwxrwx root\/root .* \.\/usr\/bin\/code-personal -> \/opt\/code-personal\/bin\/code-personal$/m);
for (const entry of ['./opt/code-personal/code-personal', './opt/code-personal/bin/code-personal', './opt/code-personal/resources/app/product.json', './usr/share/applications/code-personal.desktop', './usr/share/applications/code-personal-url-handler.desktop', './usr/share/icons/hicolor/scalable/apps/code-personal.svg', './usr/share/icons/hicolor/512x512/apps/code-personal.png', './usr/share/doc/code-personal/copyright']) {
	assert.match(contents, new RegExp(`^-rw[xs-]r-[x-]r-[x-] root/root .* ${entry.replaceAll('.', '\\.')}$`, 'm'), entry);
}
for (const line of contents.trimEnd().split('\n')) { assert.match(line, /^\S+ root\/root /, 'Every entry is owned by root'); }
console.log(`Debian package: ${deb}`);
