// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
// Entry point bundled as @vscode/vsce-sign; see adapter.cjs for the verification order.
'use strict';
const path = require('node:path');
const { verify: verifyOpenVSX } = require('node-ovsx-sign');
const { createVerifier } = require('./adapter.cjs');

// Written next to this bundle by package-verifier.mjs at build time.
exports.bundledPublicKeyFile = 'open-vsx-public.pem';
exports.createVerifier = (options = {}) => createVerifier({ verifyOpenVSX, ...options });
exports.verify = createVerifier({ verifyOpenVSX, publicKeyPath: path.join(__dirname, exports.bundledPublicKeyFile) });
