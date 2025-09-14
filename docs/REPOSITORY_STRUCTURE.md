# Repository Structure

This document describes the organization of the Obsidian Claude Code plugin repository.

## Directory Layout

```
obsidian-claude-code-ide/
├── src/                    # Source code (TypeScript)
│   ├── claude-config.ts    # Claude configuration management
│   ├── ide/               # IDE integration (Claude Code)
│   ├── mcp/               # MCP server implementation
│   ├── obsidian/          # Obsidian-specific utilities
│   ├── settings.ts        # Plugin settings
│   ├── shared/            # Shared utilities
│   ├── terminal/          # Terminal/pseudoterminal features
│   └── tools/             # Tool implementations
├── scripts/               # Utility scripts
│   └── manual/           # Manual testing scripts
│       ├── test-manual-requests.js  # Manual MCP request tester
│       └── test-mcp-client.js       # MCP client test script
├── docs/                  # Documentation
│   ├── devlog/           # Development logs
│   ├── AUTOMATED_PATCH_RELEASE.md
│   ├── COMMUNITY_SUBMISSION.md
│   ├── PROTOCOL.md
│   ├── RELEASE_CHECKLIST.md
│   └── REPOSITORY_STRUCTURE.md (this file)
├── assets/               # Images and other assets
│   └── claude-logo.png
├── .claude/              # Claude AI configuration
│   └── settings.local.json
├── main.ts              # Plugin entry point
├── manifest.json        # Obsidian plugin manifest
├── styles.css          # Plugin styles
├── package.json        # npm package configuration
├── bun.lock           # Bun package lock file
├── tsconfig.json      # TypeScript configuration
├── esbuild.config.mjs # Build configuration
├── .gitignore         # Git ignore patterns
├── .eslintrc          # ESLint configuration
├── .editorconfig      # Editor configuration
├── README.md          # Main documentation
├── CLAUDE.md          # Claude AI guidance
├── LICENSE            # MIT license
└── versions.json      # Version compatibility map
```

## Key Files

### Plugin Core
- `main.ts` - The main entry point for the Obsidian plugin
- `manifest.json` - Obsidian plugin metadata (name, version, etc.)
- `styles.css` - CSS styles for the plugin UI
- `versions.json` - Maps plugin versions to minimum Obsidian versions

### Build System
- `esbuild.config.mjs` - ESBuild configuration for bundling the plugin
- `tsconfig.json` - TypeScript compiler configuration
- `package.json` - npm/bun package configuration and scripts

### Development
- `CLAUDE.md` - Guidelines for Claude AI when working with this codebase
- `.eslintrc` - Code linting rules
- `.editorconfig` - Editor formatting preferences

## Build Output

When you run `bun run build`, the TypeScript source is compiled and bundled into:
- `main.js` - The bundled plugin file (required by Obsidian, stays in root)

## Package Manager

This project uses [Bun](https://bun.sh/) as the package manager for faster installs and better performance. The `bun.lock` file tracks exact dependency versions.

## Scripts

### Build Scripts
- `bun install` - Install dependencies
- `bun run dev` - Start development mode with file watching
- `bun run build` - Build the plugin for production
- `bun run version` - Bump version numbers

### Manual Testing
- `node scripts/manual/test-manual-requests.js` - Interactive MCP request tester
- `node scripts/manual/test-mcp-client.js` - Automated MCP client tests

## Development Workflow

1. **Setup**: Run `bun install` to install dependencies
2. **Development**: Run `bun run dev` to start the build watcher
3. **Testing**: Use the manual test scripts to verify MCP functionality
4. **Building**: Run `bun run build` to create the production bundle
5. **Release**: Follow the release checklist in `docs/RELEASE_CHECKLIST.md`
