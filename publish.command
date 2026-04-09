#!/bin/bash
# LexiconForge Novels Registry Publisher
# This script automates the git workflow for your novel registry.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "--------------------------------------------------"
echo "🚀 LexiconForge Novels Publisher"
echo "--------------------------------------------------"

if [ ! -d .git ]; then
    echo "❌ Error: This directory is not a git repository."
    read -p "Press enter to exit..."
    exit 1
fi

echo "📦 Checking for updates to your novels..."
git status -s

echo ""
read -p "Do you want to commit and push these updates to GitHub? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 Adding updates..."
    git add .
    
    echo "💾 Committing..."
    git commit -m "Update novels: chapters, metadata, and glossaries"
    
    echo "☁️  Pushing to GitHub..."
    git push
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully published! Your Vercel site will update in a moment."
    else
        echo ""
        echo "❌ Error: Push failed. Check your connection or permissions."
    fi
else
    echo "🚫 Operation cancelled."
fi

echo "--------------------------------------------------"
read -p "Press enter to close this window..."
