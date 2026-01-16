#!/usr/bin/env bash

# Release script for Obsidian Claude Code IDE plugin
# Usage: ./scripts/release.sh [patch|minor|major]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if version type is provided
VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    print_error "Invalid version type. Use: patch, minor, or major"
    exit 1
fi

print_step "Starting release process for ${VERSION_TYPE} version..."

# Check for clean working directory
if [[ -n $(git status --porcelain) ]]; then
    print_error "Working directory is not clean. Please commit or stash changes first."
    git status --short
    exit 1
fi
print_success "Working directory is clean"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed. Install it from: https://cli.github.com/"
    exit 1
fi
print_success "GitHub CLI is installed"

# Check if we're on master/main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "master" && "$CURRENT_BRANCH" != "main" ]]; then
    print_warning "You're on branch '$CURRENT_BRANCH', not master/main"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_step "Current version: $CURRENT_VERSION"

# Bump version
print_step "Bumping $VERSION_TYPE version..."
npm version $VERSION_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
print_success "New version: $NEW_VERSION"

# Run version bump script (updates manifest.json and versions.json)
print_step "Updating manifest and versions files..."
node version-bump.mjs

# Build the plugin
print_step "Building plugin..."
npm run build

if [ ! -f "main.js" ]; then
    print_error "Build failed: main.js not found"
    exit 1
fi
print_success "Build completed successfully"

# Stage the version bump changes
print_step "Staging version bump changes..."
git add package.json manifest.json versions.json
git commit -m "chore: bump version to $NEW_VERSION"
print_success "Version bump committed"

# Create git tag
print_step "Creating git tag $NEW_VERSION..."
git tag $NEW_VERSION
print_success "Tag created"

# Push to remote
print_step "Pushing to remote..."
git push && git push --tags
print_success "Pushed to remote"

# Prompt for release notes
echo ""
print_step "Enter release notes (press Ctrl+D when done):"
echo -e "${YELLOW}Tip: Use markdown format. You can paste multiple lines.${NC}"
echo ""

RELEASE_NOTES=$(cat)

if [ -z "$RELEASE_NOTES" ]; then
    print_warning "No release notes provided, using default"
    RELEASE_NOTES="Release $NEW_VERSION

See commits for changes."
fi

# Add co-author attribution
RELEASE_NOTES="$RELEASE_NOTES

---
Co-Authored-By: Warp <agent@warp.dev>"

# Create GitHub release
print_step "Creating GitHub release..."
gh release create "$NEW_VERSION" \
    --title "v$NEW_VERSION" \
    --notes "$RELEASE_NOTES" \
    manifest.json main.js styles.css

if [ $? -eq 0 ]; then
    print_success "Release created successfully!"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Release $NEW_VERSION has been published!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Release URL:"
    gh release view "$NEW_VERSION" --web
else
    print_error "Failed to create GitHub release"
    exit 1
fi
