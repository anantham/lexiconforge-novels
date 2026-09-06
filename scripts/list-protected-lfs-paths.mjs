#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const novelsRoot = path.join(repositoryRoot, 'novels');

const fileNameFromUrl = (url) => path.basename(new URL(url).pathname);

const main = async () => {
  const entries = (await readdir(novelsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const protectedPaths = [];
  for (const entry of entries) {
    const directory = path.join(novelsRoot, entry);
    const metadata = JSON.parse(await readFile(path.join(directory, 'metadata.json'), 'utf8'));
    for (const version of metadata.versions ?? []) {
      if (!version.chapterManifestUrl) continue;
      protectedPaths.push(path.posix.join('novels', entry, fileNameFromUrl(version.sessionJsonUrl)));
      const manifest = JSON.parse(await readFile(
        path.join(directory, fileNameFromUrl(version.chapterManifestUrl)),
        'utf8',
      ));
      for (const identity of manifest.chapters ?? []) {
        if (identity.artifact?.url) {
          protectedPaths.push(
            path.posix.join('novels', entry, 'chapters', fileNameFromUrl(identity.artifact.url)),
          );
        }
      }
    }
  }
  if (protectedPaths.length === 0) {
    throw new Error('No manifest-protected LFS paths found.');
  }
  process.stdout.write(`${protectedPaths.join(',')}\n`);
};

main().catch((error) => {
  console.error(`CANNOT SELECT PROTECTED LFS FILES: ${error.message}`);
  process.exitCode = 1;
});
