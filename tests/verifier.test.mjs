import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { createVerifier } = createRequire(import.meta.url)('../overlay/verifier/adapter.cjs');
const keyDir = mkdtempSync(path.join(tmpdir(), 'code-personal-verifier-'));
const bundledKey = path.join(keyDir, 'open-vsx-public.pem');
writeFileSync(bundledKey, 'bundled');
const signatureError = { code: 'SignatureManifestIsInvalid', didExecute: true, output: 'The signature is not valid' };
const networkError = Object.assign(new Error('getaddrinfo ENOTFOUND open-vsx.org'), { code: 'ENOTFOUND' });

function stub({ bundled, registry }) {
	const calls = [];
	const outcome = result => (result instanceof Error || result?.code ? Promise.reject(result) : Promise.resolve(result));
	const verifyOpenVSX = (vsix, signature, verbose, options) => {
		calls.push(options?.publicKey ?? 'registry');
		return outcome(options?.publicKey ? bundled : registry);
	};
	return { calls, verify: createVerifier({ verifyOpenVSX, publicKeyPath: bundledKey, env: {} }) };
}

test('a signature matching the bundled key never contacts the registry', async () => {
	const { calls, verify } = stub({ bundled: true });
	assert.deepEqual(await verify('x.vsix', 'x.sigzip'), { code: 'Success', didExecute: true, publicKeySource: 'bundled' });
	assert.deepEqual(calls, [bundledKey]);
});
test('a rotated registry key is fetched only after the bundled key rejects the signature', async () => {
	const { calls, verify } = stub({ bundled: signatureError, registry: true });
	assert.deepEqual(await verify('x.vsix', 'x.sigzip'), { code: 'Success', didExecute: true, publicKeySource: 'registry' });
	assert.deepEqual(calls, [bundledKey, 'registry']);
});
test('a tampered package fails with the registry verdict', async () => {
	const { verify } = stub({ bundled: signatureError, registry: signatureError });
	const result = await verify('x.vsix', 'x.sigzip');
	assert.equal(result.code, 'SignatureManifestIsInvalid');
	assert.equal(result.didExecute, true);
});
test('an unreachable registry is reported as inconclusive, with the bundled verdict in the output', async () => {
	const { verify } = stub({ bundled: signatureError, registry: networkError });
	const result = await verify('x.vsix', 'x.sigzip');
	assert.equal(result.code, 'ENOTFOUND');
	assert.equal(result.didExecute, false);
	assert.match(result.output, /bundled Open VSX key rejected the signature \(SignatureManifestIsInvalid\)/);
});
test('non-signature failures return immediately', async () => {
	const { calls, verify } = stub({ bundled: { code: 'PackageIsInvalidZip', didExecute: false, output: 'bad zip' } });
	assert.equal((await verify('x.vsix', 'x.sigzip')).code, 'PackageIsInvalidZip');
	assert.deepEqual(calls, [bundledKey]);
});
test('a missing bundled key falls back to the registry', async () => {
	const calls = [];
	const verify = createVerifier({ verifyOpenVSX: (v, s, verbose, options) => { calls.push(options); return Promise.resolve(true); }, publicKeyPath: path.join(keyDir, 'missing.pem'), env: {} });
	assert.equal((await verify('x.vsix', 'x.sigzip')).publicKeySource, 'registry');
	assert.deepEqual(calls, [undefined]);
});
test('registry overrides pointing elsewhere are refused', async () => {
	const verify = createVerifier({ verifyOpenVSX: () => Promise.resolve(true), publicKeyPath: bundledKey, env: { OVSX_REGISTRY_URL: 'https://example.com/' } });
	const result = await verify('x.vsix', 'x.sigzip');
	assert.equal(result.code, 'UnknownError');
	assert.match(result.output, /must point to https:\/\/open-vsx\.org\//);
});
