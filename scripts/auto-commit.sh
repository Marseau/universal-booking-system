#!/bin/bash

# Script para commits automáticos a cada 2 horas
# Usage: ./scripts/auto-commit.sh

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "�� Starting auto-commit script..."
echo "📍 Project directory: $PROJECT_DIR"
echo "⏰ Auto-commit interval: 2 hours"

# Function to make commit
make_commit() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Check if there are changes
    if [[ -n $(git status --porcelain) ]]; then
        echo "📝 Changes detected at $timestamp"
        
        # Add all changes
        git add -A
        
        # Create commit message
        local commit_msg="⚡ Auto-commit: $timestamp

📊 Status:
- Automatic commit every 2 hours
- Universal Booking System development
- Multi-tenant architecture progress

🔧 Latest changes auto-saved"
        
        # Commit
        git commit -m "$commit_msg"
        
        # Push to GitHub
        git push origin main
        
        echo "✅ Commit successful: $timestamp"
    else
        echo "ℹ️  No changes to commit at $timestamp"
    fi
}

# Initial commit
make_commit

# Loop for auto-commits every 2 hours (7200 seconds)
while true; do
    echo "💤 Waiting 2 hours for next auto-commit..."
    sleep 7200  # 2 hours = 7200 seconds
    make_commit
done
