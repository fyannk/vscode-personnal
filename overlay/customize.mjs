// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productPath = path.join(root, 'product.json');
const product = JSON.parse(readFileSync(productPath, 'utf8'));
const overrides = JSON.parse(readFileSync(path.join(root, '.personal-build/product-overrides.json'), 'utf8'));
// Merge only these explicit keys; all upstream AI/auth/built-in configuration survives.
Object.assign(product, overrides);
writeFileSync(productPath, JSON.stringify(product, null, '\t') + '\n');
execFileSync('rsvg-convert', ['-w', '512', '-h', '512', '-o', path.join(root, 'resources/linux/code.png'), path.join(root, '.personal-build/assets/code-personal.svg')]);
copyFileSync(path.join(root, '.personal-build/assets/code-personal.svg'), path.join(root, 'src/vs/workbench/browser/media/code-icon.svg'));
console.log('Applied Code Personal identity, Open VSX gallery, and desktop/titlebar icons.');
