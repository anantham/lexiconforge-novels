import { createHash } from 'node:crypto';

export class PublicationIntegrityError extends Error {
  constructor(message) {
    super(`Library publication integrity error: ${message}`);
    this.name = 'PublicationIntegrityError';
  }
}

const fail = (message) => {
  throw new PublicationIntegrityError(message);
};

const requirePositiveInteger = (value, field) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return fail(`${field} must be a positive safe integer.`);
  }
  return value;
};

const requireString = (value, field) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail(`${field} must be a non-empty string.`);
  }
  return value;
};

export const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

export const simpleHash = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash &= hash;
  }
  return Math.abs(hash).toString(36);
};

export const generateStableChapterId = (content, chapterNumber, title) => {
  const contentHash = simpleHash(content.substring(0, 1000));
  const titleHash = simpleHash(title);
  return `ch${chapterNumber}_${contentHash.substring(0, 8)}_${titleHash.substring(0, 4)}`;
};

const resolveVersion = (metadata, session) => {
  const metadataNovelId = requireString(metadata?.id, 'metadata.id');
  const sessionNovelId = requireString(session?.novel?.id, 'session.novel.id');
  if (metadataNovelId !== sessionNovelId) {
    return fail(`metadata novelId "${metadataNovelId}" does not match session novelId "${sessionNovelId}".`);
  }

  const sessionVersionId = requireString(session?.version?.versionId, 'session.version.versionId');
  const version = metadata?.versions?.find((candidate) => candidate.versionId === sessionVersionId);
  if (!version) {
    return fail(`metadata has no version matching session versionId "${sessionVersionId}".`);
  }
  return version;
};

const validateSessionIdentities = (session) => {
  if (!Array.isArray(session?.chapters) || session.chapters.length === 0) {
    return fail('session.chapters must contain at least one chapter.');
  }

  const chapterNumbers = new Set();
  const stableIds = new Set();
  let previousNumber = 0;
  session.chapters.forEach((chapter, index) => {
    const chapterNumber = requirePositiveInteger(
      chapter?.chapterNumber,
      `session.chapters[${index}].chapterNumber`,
    );
    const stableId = requireString(chapter?.stableId, `session.chapters[${index}].stableId`);
    requireString(chapter?.canonicalUrl, `session.chapters[${index}].canonicalUrl`);
    if (chapterNumbers.has(chapterNumber)) {
      fail(`duplicate chapter number ${chapterNumber} in session.`);
    }
    if (stableIds.has(stableId)) {
      fail(`duplicate stable ID "${stableId}" in session.`);
    }
    if (chapterNumber <= previousNumber) {
      fail(`session chapters must be strictly ordered; ${chapterNumber} follows ${previousNumber}.`);
    }
    chapterNumbers.add(chapterNumber);
    stableIds.add(stableId);
    previousNumber = chapterNumber;
  });
  return session.chapters;
};

const validateMetadataCounts = (metadata, version, chapters) => {
  const expectedCount = requirePositiveInteger(
    metadata?.metadata?.chapterCount,
    'metadata.metadata.chapterCount',
  );
  if (chapters.length > expectedCount) {
    fail(`published chapter count ${chapters.length} exceeds expected work count ${expectedCount}.`);
  }

  const declaredPublished = version?.stats?.content?.totalRawChapters;
  if (declaredPublished !== chapters.length) {
    fail(`version stats declare ${declaredPublished} raw chapters, but session contains ${chapters.length}.`);
  }

  const first = chapters[0].chapterNumber;
  const last = chapters.at(-1).chapterNumber;
  if (version?.chapterRange?.from !== first || version?.chapterRange?.to !== last) {
    fail(
      `version chapterRange ${version?.chapterRange?.from}-${version?.chapterRange?.to} `
      + `does not match published endpoints ${first}-${last}.`,
    );
  }
  if (version.completionStatus === 'Complete' && chapters.length !== expectedCount) {
    fail(`version is Complete, but only ${chapters.length} of ${expectedCount} chapters are published.`);
  }
  return expectedCount;
};

const validateManifestShape = (manifest) => {
  if (manifest?.format !== 'lexiconforge-chapter-manifest' || manifest?.version !== '1.0') {
    return fail('manifest must use format "lexiconforge-chapter-manifest" version "1.0".');
  }
  requireString(manifest.novelId, 'manifest.novelId');
  requireString(manifest.versionId, 'manifest.versionId');
  if (typeof manifest.generatedAt !== 'string' || Number.isNaN(Date.parse(manifest.generatedAt))) {
    return fail('manifest.generatedAt must be a valid date-time string.');
  }
  requirePositiveInteger(manifest.expectedChapterCount, 'manifest.expectedChapterCount');
  requirePositiveInteger(manifest.publishedChapterCount, 'manifest.publishedChapterCount');
  if (!Array.isArray(manifest.chapters)) {
    return fail('manifest.chapters must be an array.');
  }
  if (manifest.publishedChapterCount !== manifest.chapters.length) {
    return fail('manifest publishedChapterCount does not match its chapter identity count.');
  }
  requireString(manifest?.session?.url, 'manifest.session.url');
  if (!/^[a-f0-9]{64}$/.test(manifest?.session?.sha256 ?? '')) {
    return fail('manifest.session.sha256 must be a lowercase SHA-256 digest.');
  }
  requirePositiveInteger(manifest?.session?.byteLength, 'manifest.session.byteLength');
  return manifest;
};

export const createPublicationManifest = ({ metadata, session, sessionJson, generatedAt }) => {
  const version = resolveVersion(metadata, session);
  const chapters = validateSessionIdentities(session);
  const expectedChapterCount = validateMetadataCounts(metadata, version, chapters);

  return {
    format: 'lexiconforge-chapter-manifest',
    version: '1.0',
    novelId: metadata.id,
    versionId: version.versionId,
    generatedAt,
    expectedChapterCount,
    publishedChapterCount: chapters.length,
    session: {
      url: version.sessionJsonUrl,
      sha256: sha256(sessionJson),
      byteLength: Buffer.byteLength(sessionJson, 'utf8'),
    },
    chapters: chapters.map(({ chapterNumber, stableId, canonicalUrl }) => ({
      chapterNumber,
      stableId,
      canonicalUrl,
    })),
  };
};

export const validateLibraryPublication = ({ metadata, session, sessionJson, manifest }) => {
  validateManifestShape(manifest);
  const version = resolveVersion(metadata, session);
  const chapters = validateSessionIdentities(session);
  const expectedChapterCount = validateMetadataCounts(metadata, version, chapters);

  requireString(version.chapterManifestUrl, `version "${version.versionId}" chapterManifestUrl`);
  if (manifest.novelId !== metadata.id || manifest.versionId !== version.versionId) {
    fail('manifest novel/version identity does not match metadata and session.');
  }
  if (manifest.session.url !== version.sessionJsonUrl) {
    fail('manifest session URL does not match metadata session URL.');
  }
  const byteLength = Buffer.byteLength(sessionJson, 'utf8');
  if (manifest.session.byteLength !== byteLength) {
    fail(`manifest session byteLength ${manifest.session.byteLength} does not match ${byteLength}.`);
  }
  const digest = sha256(sessionJson);
  if (manifest.session.sha256 !== digest) {
    fail(`manifest session sha256 ${manifest.session.sha256} does not match ${digest}.`);
  }
  if (manifest.expectedChapterCount !== expectedChapterCount) {
    fail('manifest expectedChapterCount does not match metadata chapterCount.');
  }
  if (manifest.publishedChapterCount !== chapters.length) {
    fail('manifest publishedChapterCount does not match session count.');
  }

  chapters.forEach((chapter, index) => {
    const identity = manifest.chapters[index];
    if (
      identity?.chapterNumber !== chapter.chapterNumber
      || identity?.stableId !== chapter.stableId
      || identity?.canonicalUrl !== chapter.canonicalUrl
    ) {
      fail(`manifest identity ${index + 1} does not match the session tuple.`);
    }
  });
  return manifest;
};

export const repairContiguousChapterNumbersFromStableIds = (session) => {
  if (!Array.isArray(session?.chapters) || session.chapters.length === 0) {
    return fail('session.chapters must contain at least one chapter.');
  }

  const changes = session.chapters.map((chapter, index) => {
    const expectedNumber = index + 1;
    const title = requireString(chapter?.title, `session.chapters[${index}].title`);
    const content = requireString(chapter?.content, `session.chapters[${index}].content`);
    const expectedStableId = generateStableChapterId(content, expectedNumber, title);
    if (chapter?.stableId !== expectedStableId) {
      fail(
        `chapter row ${index + 1} cannot be repaired: stable ID "${chapter?.stableId ?? ''}" `
        + `does not reproduce as "${expectedStableId}".`,
      );
    }
    return {
      chapter,
      from: chapter.chapterNumber,
      to: expectedNumber,
      stableId: chapter.stableId,
    };
  }).filter(({ from, to }) => from !== to);

  changes.forEach(({ chapter, to }) => {
    chapter.chapterNumber = to;
  });
  validateSessionIdentities(session);
  return changes.map(({ from, to, stableId }) => ({ from, to, stableId }));
};
