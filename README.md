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

## License

Individual novels retain their original licenses. This registry structure is MIT licensed.
