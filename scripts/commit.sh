#!/bin/bash

# Script para commit manual rápido
# Usage: ./scripts/commit.sh "mensagem do commit"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Get commit message from argument or prompt
if [ "$#" -eq 0 ]; then
    echo "💬 Enter commit message:"
    read -r commit_message
else
    commit_message="$*"
fi

# Check if there are changes
if [[ -n $(git status --porcelain) ]]; then
    echo "📝 Adding changes..."
    git add -A
    
    # Create detailed commit message
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    full_commit_msg="$commit_message

⏰ Timestamp: $timestamp
🚀 Universal Booking System Development
📋 Status: Manual commit"
    
    echo "💾 Committing..."
    git commit -m "$full_commit_msg"
    
    echo "🚀 Pushing to GitHub..."
    git push origin main
    
    echo "✅ Commit successful!"
    echo "📝 Message: $commit_message"
else
    echo "ℹ️  No changes to commit"
fi
