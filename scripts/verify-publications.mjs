#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateLibraryPublication } from './lib/publication-integrity.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const novelsRoot = path.join(repositoryRoot, 'novels');

const parseJson = async (filePath) => {
  const value = await readFile(filePath, 'utf8');
  if (value.startsWith('version https://git-lfs.github.com/spec/v1')) {
    throw new Error(`${filePath} is an unhydrated Git LFS pointer; run git lfs pull before publishing.`);
  }
  try {
    return { value, parsed: JSON.parse(value) };
  } catch (error) {
    throw new Error(`${filePath} is not valid JSON: ${error.message}`);
  }
};

const localFileName = (url, field) => {
  try {
    const fileName = path.basename(new URL(url).pathname);
    if (!fileName) throw new Error('missing filename');
    return fileName;
  } catch (error) {
    throw new Error(`${field} must be an absolute URL with a filename: ${error.message}`);
  }
};

const verifyNovelDirectory = async (directoryName) => {
  const directory = path.join(novelsRoot, directoryName);
  const { parsed: metadata } = await parseJson(path.join(directory, 'metadata.json'));
  const protectedVersions = (metadata.versions ?? []).filter((version) => version.chapterManifestUrl);
  if (protectedVersions.length === 0) {
    return { protectedCount: 0, messages: [`LEGACY ${metadata.id}: no chapter manifest declared`] };
  }

  const messages = [];
  for (const version of protectedVersions) {
    const sessionPath = path.join(directory, localFileName(version.sessionJsonUrl, 'sessionJsonUrl'));
    const manifestPath = path.join(directory, localFileName(version.chapterManifestUrl, 'chapterManifestUrl'));
    const [{ value: sessionJson, parsed: session }, { parsed: manifest }] = await Promise.all([
      parseJson(sessionPath),
      parseJson(manifestPath),
    ]);
    if (session?.version?.versionId !== version.versionId) {
      throw new Error(
        `${metadata.id}/${version.versionId}: local session declares ${session?.version?.versionId ?? 'no version'}.`,
      );
    }
    validateLibraryPublication({ metadata, session, sessionJson, manifest });
    messages.push(`VERIFIED ${metadata.id}/${version.versionId}: ${manifest.publishedChapterCount} chapters`);
  }
  return { protectedCount: protectedVersions.length, messages };
};

const main = async () => {
  const entries = (await readdir(novelsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  let protectedCount = 0;
  for (const entry of entries) {
    const result = await verifyNovelDirectory(entry);
    protectedCount += result.protectedCount;
    result.messages.forEach((message) => console.log(message));
  }
  if (protectedCount === 0) {
    throw new Error('No manifest-protected library versions were found; refusing to publish without a gate.');
  }
  console.log(`Publication integrity passed for ${protectedCount} manifest-protected version(s).`);
};

main().catch((error) => {
  console.error(`PUBLICATION BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
