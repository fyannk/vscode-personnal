// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// Adapt Open VSX's verifier to the result contract used by VS Code 1.136.
const { verify: verifyOpenVSX } = require('node-ovsx-sign');

exports.verify = async (vsixFilePath, signatureArchiveFilePath, verbose = false) => {
	try {
		// This build's sole gallery is open-vsx.org. Do not silently trust a
		// different registry's signing key through inherited environment overrides.
		for (const key of ['OVSX_REGISTRY_URL', 'VSX_REGISTRY_URL']) {
			if (process.env[key] && new URL(process.env[key]).href !== 'https://open-vsx.org/') {
				throw new Error(`${key} must point to https://open-vsx.org/ for Code Personal verification`);
			}
		}
		const valid = await verifyOpenVSX(vsixFilePath, signatureArchiveFilePath, verbose);
		return { code: valid === true ? 'Success' : 'SignatureIsInvalid', didExecute: true };
	} catch (error) {
		return {
			code: typeof error.code === 'string' ? error.code : 'UnknownError',
			didExecute: error.didExecute === true,
			output: error.output || error.message || String(error)
		};
	}
};
