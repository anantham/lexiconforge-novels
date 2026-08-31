#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChapterArtifact } from './lib/chapter-artifacts.mjs';
import { validateLibraryPublication } from './lib/publication-integrity.mjs';

const GENERATED_AT = '2026-08-31T14:30:00.000Z';
const PUBLIC_BASE_URL = 'https://media.githubusercontent.com/media/anantham/lexiconforge-novels/main/novels/dungeon-defense-wn/chapters';
const EXPECTED_SESSION_SHA256 = 'd2ff34c4667a54eb0bf130d06ac939ad98acd6582451ad9fe120544412f9dcf7';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const novelDirectory = path.join(repositoryRoot, 'novels', 'dungeon-defense-wn');

const main = async () => {
  const metadata = JSON.parse(await readFile(path.join(novelDirectory, 'metadata.json'), 'utf8'));
  const sessionJson = await readFile(path.join(novelDirectory, 'session.json'), 'utf8');
  const session = JSON.parse(sessionJson);
  const manifestPath = path.join(novelDirectory, 'chapter-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  validateLibraryPublication({ metadata, session, sessionJson, manifest });
  if (manifest.session.sha256 !== EXPECTED_SESSION_SHA256 || session.chapters.length !== 476) {
    throw new Error('Dungeon Defense session provenance/count changed; refusing artifact generation.');
  }

  const artifactDirectory = path.join(novelDirectory, 'chapters');
  await mkdir(artifactDirectory, { recursive: true });
  let aggregateBytes = 0;
  for (const [index, chapter] of session.chapters.entries()) {
    const identity = manifest.chapters[index];
    if (
      identity.chapterNumber !== chapter.chapterNumber
      || identity.stableId !== chapter.stableId
      || identity.canonicalUrl !== chapter.canonicalUrl
    ) {
      throw new Error(`session/manifest tuple drift at row ${index + 1}; generation stopped.`);
    }
    const artifact = createChapterArtifact({
      novelId: metadata.id,
      versionId: session.version.versionId,
      chapter,
      publicBaseUrl: PUBLIC_BASE_URL,
    });
    await writeFile(path.join(artifactDirectory, artifact.fileName), artifact.json);
    identity.artifact = artifact.reference;
    aggregateBytes += artifact.reference.byteLength;
  }

  manifest.generatedAt = GENERATED_AT;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${session.chapters.length} exact chapter artifacts (${aggregateBytes} bytes).`);
};

main().catch((error) => {
  console.error(`ARTIFACT GENERATION BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
