import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2]);
const overlay = path.join(source, '.personal-build');
const info = JSON.parse(readFileSync(path.join(overlay, 'build-info.json'), 'utf8'));
const dist = path.join(root, 'dist');
mkdirSync(path.join(dist, 'logs'), { recursive: true });
const files = [
	[path.join(overlay, 'dist'), `code-personal-${info.upstreamTag}-linux-x64.tar.gz`],
	[path.join(overlay, 'arch'), `code-personal-${info.upstreamTag}-${info.packageRevision}-x86_64.pkg.tar.zst`]
];
for (const [directory, filename] of files) { copyFileSync(path.join(directory, filename), path.join(dist, filename)); }
writeFileSync(path.join(dist, 'build-info.json'), JSON.stringify({ ...info, buildNode: process.version, buildTime: new Date().toISOString() }, null, 2) + '\n');
for (const filename of ['verification.json', 'smoke.json', 'gallery-verification.json']) {
	copyFileSync(path.join(overlay, 'logs', filename), path.join(dist, filename));
}
for (const filename of readdirSync(path.join(overlay, 'logs'))) {
	if (/\.(log|png)$/.test(filename)) { copyFileSync(path.join(overlay, 'logs', filename), path.join(dist, 'logs', filename)); }
}
const deliverables = [...files.map(([, filename]) => filename), 'build-info.json', 'verification.json', 'smoke.json', 'gallery-verification.json'];
const checksums = deliverables.map(filename => `${createHash('sha256').update(readFileSync(path.join(dist, filename))).digest('hex')}  ${filename}`);
writeFileSync(path.join(dist, 'SHA256SUMS'), checksums.join('\n') + '\n');
console.log(`Verified artifacts collected in ${dist}`);
