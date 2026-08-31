import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  PublicationIntegrityError,
  createPublicationManifest,
  generateStableChapterId,
  repairContiguousChapterNumbersFromStableIds,
  validateLibraryPublication,
} from './lib/publication-integrity.mjs';

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
