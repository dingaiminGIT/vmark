#!/bin/bash
# Bump version across all 5 files that must stay in sync.
# See .claude/rules/40-version-bump.md for details.

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/bump-version.sh <version>"
  echo "Example: ./scripts/bump-version.sh 0.3.20"
  exit 1
fi

# Validate version format (basic semver check)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in semver format (e.g., 0.3.20)"
  exit 1
fi

echo "Bumping version to $VERSION..."

# Main app files
sed -i '' 's/"version": "[^"]*"/"version": "'$VERSION'"/' package.json
sed -i '' 's/"version": "[^"]*"/"version": "'$VERSION'"/' src-tauri/tauri.conf.json
sed -i '' 's/^version = "[^"]*"/version = "'$VERSION'"/' src-tauri/Cargo.toml

# MCP server files
sed -i '' 's/"version": "[^"]*"/"version": "'$VERSION'"/' vmark-mcp-server/package.json
sed -i '' "s/const VERSION = '[^']*'/const VERSION = '$VERSION'/" vmark-mcp-server/src/cli.ts

echo ""
echo "Updated:"
grep '"version"' package.json src-tauri/tauri.conf.json vmark-mcp-server/package.json
grep '^version' src-tauri/Cargo.toml
grep 'const VERSION' vmark-mcp-server/src/cli.ts
echo ""
echo "Done! Ready to commit."
