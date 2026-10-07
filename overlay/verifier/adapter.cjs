// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// Adapt Open VSX's verifier to the result contract VS Code expects from @vscode/vsce-sign.
//
// node-ovsx-sign downloads the registry's signing key with plain node-fetch while it
// verifies, and that request ignores the proxy VS Code itself used to download the
// extension. On hosts without a direct network path the dialog then reports a Node
// network code such as ENOTFOUND. Verify with the key bundled at build time first and
// only ask the registry when that key rejects the signature (a rotated key).
'use strict';
const { existsSync } = require('node:fs');

// Codes node-ovsx-sign raises when the signature does not match the supplied key.
const retryWithRegistryKey = new Set(['SignatureIsInvalid', 'SignatureManifestIsInvalid']);

function toResult(error) {
	return {
		code: typeof error.code === 'string' ? error.code : 'UnknownError',
		didExecute: error.didExecute === true,
		output: error.output || error.message || String(error)
	};
}

exports.createVerifier = function createVerifier({ verifyOpenVSX, publicKeyPath, env = process.env }) {
	return async function verify(vsixFilePath, signatureArchiveFilePath, verbose = false) {
		// This build's sole gallery is open-vsx.org. Do not silently trust a
		// different registry's signing key through inherited environment overrides.
		for (const key of ['OVSX_REGISTRY_URL', 'VSX_REGISTRY_URL']) {
			if (env[key] && new URL(env[key]).href !== 'https://open-vsx.org/') {
				return { code: 'UnknownError', didExecute: false, output: `${key} must point to https://open-vsx.org/ for Code Personal verification` };
			}
		}
		const attempt = async publicKey => {
			try {
				const valid = await verifyOpenVSX(vsixFilePath, signatureArchiveFilePath, verbose, publicKey ? { publicKey } : undefined);
				return { code: valid === true ? 'Success' : 'SignatureIsInvalid', didExecute: true, publicKeySource: publicKey ? 'bundled' : 'registry' };
			} catch (error) {
				return { ...toResult(error), publicKeySource: publicKey ? 'bundled' : 'registry' };
			}
		};
		if (!publicKeyPath || !existsSync(publicKeyPath)) { return attempt(undefined); }
		const bundled = await attempt(publicKeyPath);
		if (!retryWithRegistryKey.has(bundled.code)) { return bundled; }
		const registry = await attempt(undefined);
		if (registry.didExecute) { return registry; }
		// The registry could not be reached, so the verdict is inconclusive; report
		// the network failure and keep the bundled verdict in the trace output.
		return { ...registry, output: `${registry.output}\nThe bundled Open VSX key rejected the signature (${bundled.code}); the registry key could not be fetched to confirm.` };
	};
};
