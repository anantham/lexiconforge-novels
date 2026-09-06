import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';

import {
  PublicationIntegrityError,
  createPublicationManifest,
  generateStableChapterId,
  repairContiguousChapterNumbersFromStableIds,
  validateLibraryPublication,
} from './lib/publication-integrity.mjs';
import {
  createChapterArtifact,
  validateChapterArtifact,
} from './lib/chapter-artifacts.mjs';

const fixture = () => {
  const chapters = [1, 2, 3].map((chapterNumber) => {
    const title = `Chapter ${chapterNumber}`;
    const content = `Content for ${chapterNumber}`;
    return {
      chapterNumber,
      stableId: generateStableChapterId(content, chapterNumber, title),
      canonicalUrl: `https://source.example/${chapterNumber}`,
      title,
      content,
    };
  });
  const metadata = {
    id: 'fixture-novel',
    metadata: { chapterCount: 5 },
    versions: [{
      versionId: 'v1',
      sessionJsonUrl: 'https://media.example/fixture/session.json',
      chapterManifestUrl: 'https://media.example/fixture/chapter-manifest.json',
      chapterRange: { from: 1, to: 3 },
      completionStatus: 'In Progress',
      stats: { content: { totalRawChapters: 3 } },
    }],
  };
  const session = {
    novel: { id: 'fixture-novel' },
    version: { versionId: 'v1' },
    chapters,
  };
  const sessionJson = JSON.stringify(session, null, 2);
  const manifest = createPublicationManifest({
    metadata,
    session,
    sessionJson,
    generatedAt: '2026-08-31T08:30:00.000Z',
  });
  return { metadata, session, sessionJson, manifest };
};

describe('publication integrity', () => {
  test('rejects GitHub raw URLs for LFS-protected session and chapter files', () => {
    const values = fixture();
    const rawBase = 'https://raw.githubusercontent.com/example/novels/main/novels/fixture';
    values.metadata.versions[0].sessionJsonUrl = `${rawBase}/session.json`;
    values.manifest.session.url = `${rawBase}/session.json`;
    assert.throws(() => validateLibraryPublication(values), /Git LFS.*media.githubusercontent.com/);

    const other = fixture();
    other.manifest.chapters[0].artifact = {
      url: `${rawBase}/chapters/chapter-000001.json`, sha256: 'a'.repeat(64), byteLength: 1,
    };
    assert.throws(() => validateLibraryPublication(other), /Git LFS.*media.githubusercontent.com/);
  });

  test('round-trips an exact manifest against metadata and session bytes', () => {
    const values = fixture();
    assert.equal(validateLibraryPublication(values), values.manifest);
    assert.equal(values.manifest.expectedChapterCount, 5);
    assert.equal(values.manifest.publishedChapterCount, 3);
  });

  test('rejects duplicate or unordered chapter identities', () => {
    const values = fixture();
    values.session.chapters[2].chapterNumber = 2;
    assert.throws(
      () => createPublicationManifest({ ...values, generatedAt: '2026-08-31T08:30:00.000Z' }),
      (error) => error instanceof PublicationIntegrityError && /duplicate chapter number 2/.test(error.message),
    );
  });

  test('rejects byte drift after the manifest was generated', () => {
    const values = fixture();
    assert.throws(
      () => validateLibraryPublication({ ...values, sessionJson: `${values.sessionJson} ` }),
      (error) => error instanceof PublicationIntegrityError && /byteLength/.test(error.message),
    );
  });

  test('rejects a falsely complete partial publication', () => {
    const values = fixture();
    values.metadata.versions[0].completionStatus = 'Complete';
    assert.throws(
      () => createPublicationManifest({ ...values, generatedAt: '2026-08-31T08:30:00.000Z' }),
      (error) => error instanceof PublicationIntegrityError && /only 3 of 5/.test(error.message),
    );
  });
});

describe('stable-ID-proven chapter-number repair', () => {
  test('changes only number fields after every stable ID reproduces', () => {
    const values = fixture();
    values.session.chapters[1].chapterNumber = 4;
    const before = values.session.chapters.map(({ chapterNumber: _number, ...chapter }) => ({ ...chapter }));

    const changes = repairContiguousChapterNumbersFromStableIds(values.session);

    assert.deepEqual(changes, [{
      from: 4,
      to: 2,
      stableId: values.session.chapters[1].stableId,
    }]);
    assert.deepEqual(values.session.chapters.map(({ chapterNumber: _number, ...chapter }) => chapter), before);
    assert.deepEqual(values.session.chapters.map((chapter) => chapter.chapterNumber), [1, 2, 3]);
  });

  test('fails atomically before changing any number when one row lacks provenance', () => {
    const values = fixture();
    values.session.chapters[0].chapterNumber = 9;
    values.session.chapters[2].stableId = 'unverifiable';
    const numbersBefore = values.session.chapters.map((chapter) => chapter.chapterNumber);

    assert.throws(
      () => repairContiguousChapterNumbersFromStableIds(values.session),
      (error) => error instanceof PublicationIntegrityError && /cannot be repaired/.test(error.message),
    );
    assert.deepEqual(values.session.chapters.map((chapter) => chapter.chapterNumber), numbersBefore);
  });
});

describe('immutable chapter artifacts', () => {
  test('keeps revision addresses distinct while reusing unchanged chapter bytes', () => {
    const { metadata, session } = fixture();
    const input = { novelId: metadata.id, versionId: 'v1', chapter: session.chapters[0],
      publicBaseUrl: 'https://media.example/fixture/chapters' };
    const original = createChapterArtifact(input);
    assert.deepEqual(createChapterArtifact(input), original);
    const revised = createChapterArtifact({ ...input, chapter: { ...input.chapter, content: 'Revised content' } });
    const nextVersion = createChapterArtifact({ ...input, versionId: 'v2' });
    assert.equal(new Set([original, revised, nextVersion].map(artifact => artifact.reference.url)).size, 3);
  });

  test('round-trips exact bytes and the manifest identity tuple', () => {
    const values = fixture();
    const identity = values.manifest.chapters[1];
    const artifact = createChapterArtifact({
      novelId: values.metadata.id,
      versionId: 'v1',
      chapter: values.session.chapters[1],
      publicBaseUrl: 'https://media.example/fixture/chapters',
    });

    assert.equal(validateChapterArtifact({
      json: artifact.json,
      document: artifact.document,
      reference: artifact.reference,
      context: { novelId: values.metadata.id, versionId: 'v1', identity },
    }), artifact.document);
    assert.equal(artifact.fileName, `chapter-000002-${artifact.reference.sha256}.json`);
  });

  test('rejects byte drift and tuple drift independently', () => {
    const values = fixture();
    const identity = values.manifest.chapters[1];
    const artifact = createChapterArtifact({
      novelId: values.metadata.id,
      versionId: 'v1',
      chapter: values.session.chapters[1],
      publicBaseUrl: 'https://media.example/fixture/chapters',
    });
    assert.throws(
      () => validateChapterArtifact({
        json: `${artifact.json} `,
        document: artifact.document,
        reference: artifact.reference,
        context: { novelId: values.metadata.id, versionId: 'v1', identity },
      }),
      /byteLength/,
    );

    const wrongTuple = structuredClone(artifact.document);
    wrongTuple.chapter.chapterNumber = 99;
    const wrongJson = JSON.stringify(wrongTuple, null, 2);
    const wrongReference = {
      ...artifact.reference,
      byteLength: Buffer.byteLength(wrongJson, 'utf8'),
      sha256: createHash('sha256').update(wrongJson, 'utf8').digest('hex'),
    };
    assert.throws(
      () => validateChapterArtifact({
        json: wrongJson,
        document: wrongTuple,
        reference: wrongReference,
        context: { novelId: values.metadata.id, versionId: 'v1', identity },
      }),
      /tuple does not match/,
    );
  });
});
