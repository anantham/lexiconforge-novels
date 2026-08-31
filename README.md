# LexiconForge Novels Registry

Community-curated collection of web novel translations for LexiconForge.

## Adding Your Novel

1. Fork this repository
2. Create a folder in `novels/` with your novel ID
3. Add `metadata.json` with your novel information
4. Upload your `session.json` (or host it elsewhere)
5. Add your novel entry to `registry.json`
6. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions.

## Structure

```
.
├── registry.json          # Main registry file
├── novels/
│   ├── novel-id-1/
│   │   ├── metadata.json
│   │   ├── chapter-manifest.json # Exact identities + session/artifact checksums
│   │   ├── chapters/             # Optional exact, independently fetchable chapter artifacts
│   │   │   └── chapter-000001.json
│   │   └── session.json   (optional, can be hosted elsewhere)
│   └── novel-id-2/
│       ├── metadata.json
│       └── session.json
```

## Registry Format

Each entry in `registry.json`:

```json
{
  "id": "unique-novel-id",
  "metadataUrl": "https://raw.githubusercontent.com/USERNAME/lexiconforge-novels/main/novels/novel-id/metadata.json"
}
```

## Guidelines

- Use descriptive IDs (lowercase, hyphens)
- Include complete metadata
- Verify session.json works in LexiconForge
- Respect copyright - only upload licensed translations
- Credit all contributors properly

## Publication integrity

Migrated versions declare `chapterManifestUrl` in `metadata.json`. Their manifest records the exact
ordered chapter identities currently published and the SHA-256/byte length of `session.json`.
An identity may also reference an independently fetchable chapter artifact with its own URL,
SHA-256, and byte length. Once a version publishes any artifacts, it must publish one for every
manifest identity; partial artifact coverage is rejected.
Expected work size remains separate, so an in-progress 476-chapter publication may still describe a
509-chapter work without advertising the unpublished chapters as navigable.

Chapter artifacts intentionally duplicate chapter data from `session.json`. This lets clients fetch
and verify one chapter without downloading the complete session, while keeping the session as the
portable full-publication representation. Both sessions and `chapters/*.json` are stored with Git
LFS. CI hydrates the files referenced by protected manifests and rejects missing bytes, checksum
drift, malformed artifacts, partial coverage, or a chapter number/stable ID/canonical URL mismatch.

Run the same fail-closed check used by `publish.command` and CI before publication:

```bash
git lfs pull
node --test scripts/publication-integrity.test.mjs
node scripts/verify-publications.mjs
```

Legacy versions remain readable while they are migrated, but at least one manifest-protected version
must validate before the publisher will commit or push.

## License

Individual novels retain their original licenses. This registry structure is MIT licensed.
