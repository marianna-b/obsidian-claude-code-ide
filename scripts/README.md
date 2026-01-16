# Release Scripts

Automated scripts for creating plugin releases.

## Quick Start

### Create a Patch Release (Bug Fixes)
```bash
npm run release:patch
```

### Create a Minor Release (New Features)
```bash
npm run release:minor
```

### Create a Major Release (Breaking Changes)
```bash
npm run release:major
```

## What the Script Does

The release script (`release.sh`) automates the entire release process:

1. ✅ **Validates Environment**
   - Checks for clean working directory
   - Verifies GitHub CLI (`gh`) is installed
   - Confirms you're on master/main branch

2. 📝 **Version Bumping**
   - Bumps version in `package.json`
   - Updates `manifest.json` via `version-bump.mjs`
   - Updates `versions.json` for compatibility

3. 🏗️ **Build**
   - Runs `npm run build` to compile the plugin
   - Verifies `main.js` was created successfully

4. 📦 **Git Operations**
   - Commits version bump changes
   - Creates git tag with new version
   - Pushes commits and tags to remote

5. 📰 **GitHub Release**
   - Prompts for release notes
   - Creates GitHub release with version tag
   - Uploads required files: `manifest.json`, `main.js`, `styles.css`
   - Adds co-author attribution

## Prerequisites

- **Clean Git Directory**: All changes must be committed
- **GitHub CLI**: Install from https://cli.github.com/
- **Node.js**: For running build scripts

## Usage Examples

### Simple Patch Release
```bash
npm run release:patch
```
Then paste your release notes when prompted, press Ctrl+D when done.

### With Pre-written Release Notes
```bash
npm run release:patch <<EOF
## Bug Fixes
- Fixed stale lock file cleanup
- Improved error handling in diff view

## Improvements  
- Added Cancel button to inline diff
EOF
```

### Direct Script Usage
```bash
./scripts/release.sh minor
```

## Release Notes Format

When prompted, you can use Markdown formatting:

```markdown
## What's Changed

### 🐛 Bug Fixes
- Fixed issue with lock file accumulation
- Improved diff rendering stability

### ✨ New Features
- Added Cancel button to inline diff header
- Automatic cleanup of stale lock files

### 🔧 Technical Improvements
- Refactored error handling
- Added null safety checks throughout

### 📝 Documentation
- Updated README with accurate tool listings
```

The script automatically adds co-author attribution:
```
---
Co-Authored-By: Warp <agent@warp.dev>
```

## Troubleshooting

### "Working directory is not clean"
**Solution**: Commit or stash your changes first
```bash
git status
git add .
git commit -m "your message"
```

### "gh: command not found"
**Solution**: Install GitHub CLI
```bash
brew install gh  # macOS
# or visit https://cli.github.com/
```

### "Not on master/main branch"
**Solution**: Either switch to master/main or continue when prompted
```bash
git checkout master
```

### Build fails
**Solution**: Check TypeScript compilation errors
```bash
npm run build
# Fix any errors shown
```

## Manual Release Process

If you prefer manual control, follow these steps:

```bash
# 1. Bump version
npm version patch  # or minor/major

# 2. Build
npm run build

# 3. Push
git push && git push --tags

# 4. Create release
gh release create 1.2.3 \
  --title "v1.2.3" \
  --notes "Your release notes" \
  manifest.json main.js styles.css
```

See `docs/AUTOMATED_PATCH_RELEASE.md` for more details.

## Version Types

- **patch**: Bug fixes and minor improvements (1.1.9 → 1.1.10)
- **minor**: New features, backward compatible (1.1.9 → 1.2.0)
- **major**: Breaking changes (1.1.9 → 2.0.0)

## Related Documentation

- `docs/AUTOMATED_PATCH_RELEASE.md` - Detailed patch release guide
- `docs/RELEASE_CHECKLIST.md` - Complete release checklist for community submission
