#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPublicationManifest,
  repairContiguousChapterNumbersFromStableIds,
  sha256,
  validateLibraryPublication,
} from './lib/publication-integrity.mjs';

const EXPECTED_SOURCE_SHA256 = '9098db5400f2c0abb844c90e7109b6837a2d068a86b8d7b0a59aac1c9f31c568';
const GENERATED_AT = '2026-08-31T08:30:00.000Z';
const MANIFEST_URL = 'https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels/dungeon-defense-wn/chapter-manifest.json';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const novelDirectory = path.join(repositoryRoot, 'novels', 'dungeon-defense-wn');

const main = async () => {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    throw new Error('Usage: node scripts/migrate-dungeon-defense-publication.mjs <verified-source-session.json>');
  }
  const sourceJson = await readFile(path.resolve(sourcePath), 'utf8');
  const sourceDigest = sha256(sourceJson);
  if (sourceDigest !== EXPECTED_SOURCE_SHA256) {
    throw new Error(`source SHA-256 ${sourceDigest} does not match ${EXPECTED_SOURCE_SHA256}; no files written.`);
  }

  const metadataPath = path.join(novelDirectory, 'metadata.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const session = JSON.parse(sourceJson);
  const changes = repairContiguousChapterNumbersFromStableIds(session);
  if (changes.length !== 29) {
    throw new Error(`expected exactly 29 proven number repairs, found ${changes.length}; no files written.`);
  }

  const version = metadata.versions.find((candidate) => candidate.versionId === session.version.versionId);
  version.chapterManifestUrl = MANIFEST_URL;
  version.chapterRange = { from: 1, to: session.chapters.length };
  version.stats.content.totalRawChapters = session.chapters.length;
  version.lastUpdated = '2026-08-31';
  metadata.metadata.lastUpdated = '2026-08-31';

  const sessionJson = JSON.stringify(session, null, 2);
  version.stats.fileSize = `${(Buffer.byteLength(sessionJson, 'utf8') / 1024 / 1024).toFixed(2)}MB`;
  const manifest = createPublicationManifest({ metadata, session, sessionJson, generatedAt: GENERATED_AT });
  validateLibraryPublication({ metadata, session, sessionJson, manifest });

  await Promise.all([
    writeFile(path.join(novelDirectory, 'session.json'), sessionJson),
    writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`),
    writeFile(path.join(novelDirectory, 'chapter-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
  console.log(`Repaired ${changes.length} chapter numbers; all 476 stable IDs reproduced before writing.`);
  changes.forEach(({ from, to, stableId }) => console.log(`  ${stableId}: ${from} -> ${to}`));
  console.log(`Repaired session SHA-256: ${manifest.session.sha256}`);
};

main().catch((error) => {
  console.error(`MIGRATION BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
