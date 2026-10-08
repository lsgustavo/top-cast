import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'dist/index.html',
  'dist-electron/main/main.js',
  'dist-electron/preload/preload.mjs',
  'dist-server/server/index.js',
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  try {
    await access(absolutePath);
  } catch {
    throw new Error(`Production build artifact is missing: ${relativePath}`);
  }
}

const html = await readFile(path.join(projectRoot, 'dist/index.html'), 'utf8');
if (/(?:src|href)="\/assets\//.test(html)) {
  throw new Error('Production renderer assets must use relative paths to load from Electron file:// URLs.');
}

const assets = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)]
  .map((match) => match[1]);
if (!assets.some((asset) => asset.endsWith('.js')) || !assets.some((asset) => asset.endsWith('.css'))) {
  throw new Error('Production renderer HTML does not reference both JavaScript and CSS bundles.');
}

for (const asset of assets) {
  try {
    await access(path.join(projectRoot, 'dist', asset));
  } catch {
    throw new Error(`Production renderer asset is missing: ${asset}`);
  }
}

console.log('Windows production build artifacts verified. Installer generation is handled by build:installer.');
