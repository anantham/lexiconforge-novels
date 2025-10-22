#!/usr/bin/env python3
"""
Fix inconsistent chapterNumber data in eternal-life session.json

Problem: First 5 chapters have chapterNumber: null, then chapter 6 has number 5 (off by one),
causing duplicate stableIds when chapters are re-fetched with proper numbers.

Solution: Extract chapter numbers from titles using regex patterns and update the session.json.
"""

import json
import re
import sys
from pathlib import Path
from typing import Optional

def extract_chapter_number(title: str) -> Optional[int]:
    """Extract chapter number from title using multiple patterns"""
    if not title:
        return None

    # Pattern 1: "Chapter 123" or "Ch 123" or "Ch. 123"
    match = re.search(r'(?:Chapter|Ch\.?)\s+(\d+)', title, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # Pattern 2: Chinese "第123章" or "第一二三章"
    match = re.search(r'第(\d+)章', title)
    if match:
        return int(match.group(1))

    # Pattern 3: Numbers at start "123. Title" or "123 - Title"
    match = re.search(r'^(\d+)[.\-\s]', title)
    if match:
        return int(match.group(1))

    # Pattern 4: Chinese number characters "第一章", "第二章" etc
    chinese_numbers = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    }
    match = re.search(r'第([一二三四五六七八九十]+)章', title)
    if match:
        cn = match.group(1)
        if cn in chinese_numbers:
            return chinese_numbers[cn]

    return None

def fix_chapter_numbers(session_file: Path) -> None:
    """Fix chapterNumbers in session.json file"""

    print(f"[FIX] Reading {session_file}...")
    with open(session_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    chapters = data.get('chapters', [])
    print(f"[FIX] Found {len(chapters)} chapters")

    updated_count = 0
    failed_count = 0

    for i, chapter in enumerate(chapters, start=1):
        current_number = chapter.get('chapterNumber')
        title = chapter.get('title', '')

        # Extract chapter number from title
        extracted_number = extract_chapter_number(title)

        if extracted_number is None:
            # Fallback to sequential numbering based on position
            extracted_number = i
            print(f"[FIX] Ch #{i}: Could not extract from title \"{title}\", using position {i}")

        # Update if different
        if current_number != extracted_number:
            print(f"[FIX] Ch #{i}: \"{title}\" → changing {current_number} to {extracted_number}")
            chapter['chapterNumber'] = extracted_number
            updated_count += 1
        else:
            print(f"[FIX] Ch #{i}: \"{title}\" already has correct number {current_number}")

    print(f"\n[FIX] Summary:")
    print(f"[FIX]   Total chapters: {len(chapters)}")
    print(f"[FIX]   Updated: {updated_count}")
    print(f"[FIX]   Already correct: {len(chapters) - updated_count}")

    # Write back
    backup_file = session_file.with_suffix('.json.bak')
    print(f"\n[FIX] Creating backup: {backup_file}")
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[FIX] Writing corrected data to {session_file}")
    with open(session_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[FIX] ✅ Done!")

if __name__ == '__main__':
    session_file = Path('/Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/eternal-life/session.json')

    if not session_file.exists():
        print(f"[FIX] ❌ Error: {session_file} not found")
        sys.exit(1)

    fix_chapter_numbers(session_file)
