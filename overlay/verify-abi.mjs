// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// Ensure rolling build-host libraries never leak into native Node add-ons.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, fstatSync, openSync, readSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultArtifacts = [
	path.resolve(root, '../VSCode-linux-x64'),
	path.resolve(root, '../CodePersonal-server-linux-x64'),
];
const artifacts = process.argv.length > 2 ? process.argv.slice(2).map(directory => path.resolve(directory)) : defaultArtifacts;
const ceilings = new Map([
	['GLIBC', [2, 28]],
	['GLIBCXX', [3, 4, 25]],
]);

function compareVersions(left, right) {
	for (let index = 0; index < Math.max(left.length, right.length); index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) { return difference; }
	}
	return 0;
}

function* files(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const candidate = path.join(directory, entry.name);
		if (entry.isDirectory()) { yield* files(candidate); }
		else if (entry.isFile()) { yield candidate; }
	}
}

function isElf(file) {
	const descriptor = openSync(file, 'r');
	try {
		if (fstatSync(descriptor).size < 4) { return false; }
		const magic = Buffer.alloc(4);
		readSync(descriptor, magic, 0, magic.length, 0);
		return magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
	} finally {
		closeSync(descriptor);
	}
}

const violations = [];
let addonCount = 0;
for (const artifact of artifacts) {
	assert.ok(existsSync(artifact), `Missing artifact: ${artifact}`);
	for (const file of files(artifact)) {
		if (path.extname(file) !== '.node' || !isElf(file)) { continue; }
		addonCount++;
		const versions = execFileSync('readelf', ['--version-info', '--wide', file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
		for (const [family, ceiling] of ceilings) {
			const expression = new RegExp(`\\b${family}_([0-9]+(?:\\.[0-9]+)+)\\b`, 'g');
			for (const match of versions.matchAll(expression)) {
				const version = match[1].split('.').map(Number);
				if (compareVersions(version, ceiling) > 0) {
					violations.push(`${path.relative(root, file)} requires ${family}_${match[1]} (maximum ${family}_${ceiling.join('.')})`);
				}
			}
		}
	}
}
const uniqueViolations = [...new Set(violations)].sort();
if (uniqueViolations.length > 0) { throw new Error(`Linux ABI baseline violations:\n${uniqueViolations.join('\n')}`); }
assert.ok(addonCount > 0, 'Expected at least one native Node add-on');
const report = { nativeAddonsInspected: addonCount, maximumVersions: Object.fromEntries([...ceilings].map(([name, version]) => [name, version.join('.')])), result: 'passed' };
writeFileSync(path.join(root, '.personal-build/logs/abi.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Linux ABI baseline check passed for ${addonCount} native Node add-ons.`);
