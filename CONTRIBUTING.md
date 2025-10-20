# Contributing to LexiconForge Novels Registry

Thank you for contributing translations to the community!

## Prerequisites

1. A complete translation in LexiconForge
2. Proper licensing/permission to share
3. Complete metadata information

## Adding a New Novel

### Option A: Using LexiconForge Export (Recommended)

1. Open your translation in LexiconForge
2. Go to **Settings → Metadata**
3. Fill in the Novel Metadata Form:
   - Title, Author, Description
   - Original language and target language
   - Genres and tags
   - Links (Novel Updates, source, etc.)
4. Go to **Settings → Export**
5. Click **"Publish to Library"**
6. Download both files:
   - `metadata.json`
   - `session.json`

### Option B: Manual Creation

Create `metadata.json` following this template:

```json
{
  "id": "your-novel-id",
  "title": "Novel Title",
  "sessionJsonUrl": "URL to session.json",
  "metadata": {
    "author": "Original Author Name",
    "originalLanguage": "Korean",
    "targetLanguage": "English",
    "chapterCount": 100,
    "genres": ["Fantasy", "Action"],
    "description": "Full description...",
    "coverImageUrl": "https://...",
    "rating": 4.5,
    "sourceUrl": "https://www.novelupdates.com/...",
    "sourceName": "Novel Updates",
    "translator": "Your Name",
    "tags": ["Tag1", "Tag2"],
    "lastUpdated": "2025-10-20"
  },
  "versions": [
    {
      "versionId": "v1",
      "displayName": "Official Translation",
      "translator": {
        "name": "Your Name",
        "link": "https://your-site.com"
      },
      "sessionJsonUrl": "URL to this version's session.json",
      "targetLanguage": "English",
      "style": "faithful",
      "features": ["complete", "high-quality"],
      "chapterRange": { "from": 1, "to": 509 },
      "completionStatus": "Complete",
      "lastUpdated": "2025-10-20",
      "stats": {
        "downloads": 0,
        "fileSize": "125MB",
        "content": {
          "totalImages": 0,
          "totalFootnotes": 100,
          "totalRawChapters": 509,
          "totalTranslatedChapters": 509,
          "avgImagesPerChapter": 0,
          "avgFootnotesPerChapter": 0.2
        },
        "translation": {
          "translationType": "human",
          "feedbackCount": 0,
          "qualityRating": 4.5
        }
      }
    }
  ]
}
```

## Submission Process

1. **Fork this repository**

2. **Create your novel folder**:
   ```bash
   mkdir novels/your-novel-id
   ```

3. **Add your files**:
   ```bash
   # Add metadata
   cp ~/Downloads/metadata.json novels/your-novel-id/

   # Add session (optional - can host elsewhere)
   cp ~/Downloads/session.json novels/your-novel-id/
   ```

4. **Update registry.json**:
   ```json
   {
     "id": "your-novel-id",
     "metadataUrl": "https://raw.githubusercontent.com/YOUR_USERNAME/lexiconforge-novels/main/novels/your-novel-id/metadata.json"
   }
   ```

5. **Commit and push**:
   ```bash
   git add .
   git commit -m "Add [Novel Title]"
   git push origin main
   ```

6. **Create Pull Request** on GitHub

## Adding a New Version to Existing Novel

If you want to add an alternate translation/version:

1. Fork the repo
2. Edit the novel's `metadata.json`
3. Add your version to the `versions` array
4. Upload your `session.json` (with unique filename)
5. Update the version's `sessionJsonUrl`
6. Submit PR with description of your version

## Hosting Large Files

If `session.json` is too large for GitHub (>100MB):

**Option 1: GitHub Releases**
- Create a release
- Attach session.json
- Use release asset URL in metadata

**Option 2: External Hosting**
- Upload to your own CDN/server
- Use absolute URL in metadata
- Ensure CORS is enabled

**Option 3: Git LFS**
- Use Git Large File Storage
- Track session.json files
- Automatic with GitHub

## Review Process

PRs will be reviewed for:
- Metadata completeness
- Valid JSON format
- Working session.json URL
- Proper licensing/attribution
- No malicious content

Usually approved within 48 hours.

## Questions?

Open an issue or contact maintainers.
