import { PublicationIntegrityError, sha256 } from './publication-integrity.mjs';

const fail = (message) => {
  throw new PublicationIntegrityError(`chapter artifact: ${message}`);
};

export const chapterArtifactFileName = (chapterNumber) =>
  `chapter-${String(chapterNumber).padStart(6, '0')}.json`;

export const createChapterArtifact = ({ novelId, versionId, chapter, publicBaseUrl }) => {
  const document = {
    format: 'lexiconforge-chapter-artifact',
    version: '1.0',
    novelId,
    versionId,
    chapter,
  };
  const json = JSON.stringify(document, null, 2);
  const fileName = chapterArtifactFileName(chapter.chapterNumber);
  return {
    fileName,
    document,
    json,
    reference: {
      url: `${publicBaseUrl.replace(/\/$/, '')}/${fileName}`,
      sha256: sha256(json),
      byteLength: Buffer.byteLength(json, 'utf8'),
    },
  };
};

export const validateChapterArtifact = ({ json, document, reference, context }) => {
  const byteLength = Buffer.byteLength(json, 'utf8');
  if (reference.byteLength !== byteLength) {
    return fail(`byteLength ${reference.byteLength} does not match ${byteLength}.`);
  }
  const digest = sha256(json);
  if (reference.sha256 !== digest) {
    return fail(`SHA-256 ${reference.sha256} does not match ${digest}.`);
  }
  if (document?.format !== 'lexiconforge-chapter-artifact' || document?.version !== '1.0') {
    return fail('format/version must be lexiconforge-chapter-artifact 1.0.');
  }
  if (document.novelId !== context.novelId || document.versionId !== context.versionId) {
    return fail('novel/version identity does not match the manifest context.');
  }
  const chapter = document.chapter;
  if (
    chapter?.chapterNumber !== context.identity.chapterNumber
    || chapter?.stableId !== context.identity.stableId
    || chapter?.canonicalUrl !== context.identity.canonicalUrl
  ) {
    return fail('chapter number/stable ID/canonical URL tuple does not match the manifest identity.');
  }
  if (typeof chapter.title !== 'string' || chapter.title.trim().length === 0) {
    return fail('chapter.title must be a non-empty string.');
  }
  if (typeof chapter.content !== 'string' || chapter.content.trim().length === 0) {
    return fail('chapter.content must be a non-empty string.');
  }
  return document;
};
