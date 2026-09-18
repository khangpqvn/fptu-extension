#!/usr/bin/env node
/**
 * build.js — Package src/ into dist/domain-shortcuts.zip for Chrome Web Store.
 * Usage:  node build.js
 * Requires: Node.js 18+ (no external deps)
 */
import { mkdir, readdir, rm, stat } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const ZIP_NAME = 'domain-shortcuts.zip';
const ZIP_PATH = join(DIST, ZIP_NAME);

const EXCLUDE = new Set(['build.js', 'store-description.md', 'node_modules']);

async function collectFiles(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (EXCLUDE.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collectFiles(full, rel));
    } else if (entry.isFile()) {
      files.push({ rel, full });
    }
  }
  return files;
}

async function main() {
  const files = await collectFiles(SRC);
  if (!files.length) {
    console.error('No source files found in src/.');
    process.exit(1);
  }

  await mkdir(DIST, { recursive: true });

  const isWindows = process.platform === 'win32';
  const absSrc = SRC.replace(/\//g, '\\');
  const absZip = ZIP_PATH.replace(/\//g, '\\');

  if (isWindows) {
    // cd into src so files are at root of zip (manifest.json not src/manifest.json)
    execSync(
      `powershell -NoProfile -Command "` +
      `Set-Location -Path '${absSrc}' -ErrorAction Stop; ` +
      `Get-ChildItem -Recurse -File | ` +
      `Where-Object { $_.Name -notin @('build.js','store-description.md') } | ` +
      `Compress-Archive -DestinationPath '${absZip}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(
      `cd "${SRC}" && zip -r "${ZIP_PATH}" . -x "build.js" -x "store-description.md"`,
      { stdio: 'inherit' }
    );
  }

  const size = await stat(ZIP_PATH).then(s => (s.size / 1024).toFixed(1));
  console.log(`\nPackaged ${files.length} files -> ${ZIP_PATH} (${size} KB)`);
  console.log('Files included:');
  files.forEach((f) => console.log(`  ${f.rel}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
