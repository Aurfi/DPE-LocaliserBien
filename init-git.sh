#!/bin/bash

echo "📦 Initializing Git repository for GitHub..."

# Initialize git if not already done
if [ ! -d ".git" ]; then
    git init
    echo "✅ Git repository initialized"
else
    echo "ℹ️  Git repository already exists"
fi

# Add all files
git add .

echo ""
echo "📝 Ready to commit! Use this command:"
echo ""
echo "git commit -m \"Initial commit\""
echo ""
echo "🔗 Then add your GitHub remote:"
echo "git remote add origin https://github.com/YOUR_USERNAME/DPE-LocaliserBien.git"
echo ""
echo "📤 Finally, push to GitHub:"
echo "git branch -M main"
echo "git push -u origin main"
echo ""
echo "⚠️  Make sure you've created the repository on GitHub first!"
echo "⚠️  Repository should be PRIVATE to protect your .env file"