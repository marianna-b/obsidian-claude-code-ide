# Claude Code IDE Integration - Implementation Tasks

## Overview

This document consolidates all implementation tasks for missing Claude Code IDE features. Each task includes current status, requirements, and specific implementation steps.

## Verified Implementation Assumptions

Based on code analysis:

1. ✅ **Editor interface is available** - Obsidian provides `Editor` interface with `getCursor()` and `getSelection()` methods
2. ✅ **File paths are relative to vault** - Confirmed by existing path normalization utilities
3. ✅ **Single vault/workspace active** - Obsidian's architecture supports one active vault
4. ✅ **WebSocket localhost only** - Current implementation binds to 127.0.0.1
5. ✅ **Lock file cleanup on unload** - Handled in dual-server.ts
6. ⚠️ **Diff view implementation** - Can leverage obsidian-file-diff plugin patterns instead of custom CodeMirror
7. ✅ **Selection tracking transient** - No persistence needed between sessions

## Implementation Tasks

### 1. ❌ WebSocket Authentication

**Priority**: HIGH (Security)

**Requirements**:
- Validate `x-claude-code-ide-authorization` header against lock file token
- Close connection with 4401 code on auth failure
- No auth for localhost HTTP/SSE endpoints

**Implementation**:
- [ ] Add auth validation to WebSocket upgrade handler in `src/mcp/server.ts`
- [ ] Read token from lock file during server initialization
- [ ] Add connection rejection with proper error code
- [ ] Add unit tests for auth accept/reject scenarios

**Done when**: All WebSocket connections require valid auth token

---

### 2. ❌ Tool: openFile

**Priority**: HIGH

**Protocol Shape**:
```typescript
interface OpenFileParams {
  filePath: string;
  preview?: boolean;
  startText?: string;
  endText?: string;
  selectToEndOfLine?: boolean;
  makeFrontmost?: boolean;
}
```

**Implementation**:
- [ ] Add tool definition to `src/ide/ide-tools.ts`
- [ ] Implement file opening with `app.workspace.openLinkText()`
- [ ] Add text search and selection using Editor API
- [ ] Return simple text when `makeFrontmost=true`
- [ ] Return JSON-stringified details when `makeFrontmost=false`
- [ ] Handle file not found errors
- [ ] Add unit tests for all parameter combinations

**Done when**: Opens files and selects text ranges as specified

---

### 3. ❌ Tool: getCurrentSelection

**Priority**: HIGH

**Response Format**:
```typescript
interface SelectionResponse {
  success: boolean;
  text?: string;
  filePath?: string;
  selection?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message?: string; // For error case
}
```

**Implementation**:
- [ ] Add tool to IDE tools
- [ ] Get active editor using workspace API
- [ ] Extract selection with `editor.getSelection()`
- [ ] Get cursor positions with `editor.getCursor('from')` and `getCursor('to')`
- [ ] Return JSON-stringified response
- [ ] Handle no active editor case
- [ ] Add tests for selection/no-selection cases

**Done when**: Returns current selection in correct format

---

### 4. ❌ Tool: getLatestSelection

**Priority**: MEDIUM

**Implementation**:
- [ ] Add selection caching to WorkspaceManager
- [ ] Update cache on every selection change
- [ ] Create tool that returns cached selection
- [ ] Return error when no selection history
- [ ] Add tests for persistence across editor changes

**Done when**: Tracks and returns last selection even after editor change

---

### 5. ❌ Tool: getOpenEditors

**Priority**: MEDIUM

**Response Format**:
```typescript
interface OpenEditorsResponse {
  tabs: Array<{
    uri: string;
    isActive: boolean;
    label: string;
    languageId: string;
    isDirty: boolean;
  }>;
}
```

**Implementation**:
- [ ] Get all leaves with `app.workspace.getLeavesOfType('markdown')`
- [ ] Map leaves to tab format
- [ ] Identify active leaf
- [ ] Detect file language from extension
- [ ] Check dirty state (if available in Obsidian API)
- [ ] Return JSON-stringified response
- [ ] Add tests for multi-file scenarios

**Done when**: Lists all open files in tab format

---

### 6. ❌ Tool: getWorkspaceFolders

**Priority**: MEDIUM

**Response Format**:
```typescript
interface WorkspaceFoldersResponse {
  success: boolean;
  folders: Array<{
    name: string;
    uri: string;
    path: string;
  }>;
  rootPath: string;
}
```

**Implementation**:
- [ ] Get vault base path from adapter
- [ ] Format as single workspace folder
- [ ] Include vault name and absolute path
- [ ] Return JSON-stringified response
- [ ] Add error handling
- [ ] Add unit tests

**Done when**: Returns vault as workspace folder

---

### 7. ❌ Tool: checkDocumentDirty

**Priority**: LOW

**Implementation**:
- [ ] Find document in workspace leaves
- [ ] Check if Obsidian tracks dirty state
- [ ] If not available, always return `isDirty: false`
- [ ] Return JSON-stringified response
- [ ] Handle non-open documents
- [ ] Add tests for various states

**Done when**: Returns dirty state or graceful fallback

---

### 8. ❌ Tool: saveDocument

**Priority**: LOW

**Implementation**:
- [ ] Find document in workspace
- [ ] Trigger save if possible
- [ ] Return success/already saved message
- [ ] Handle non-open documents
- [ ] Return JSON-stringified response
- [ ] Add tests

**Done when**: Saves documents when possible

---

### 9. ⚠️ Tool: openDiff (Full Implementation)

**Priority**: HIGH

**Current**: Stub returns success without visual diff

**Approach**: Use obsidian-file-diff patterns instead of custom implementation

**Implementation**:
- [ ] Create DiffView extending ItemView (similar to file-diff plugin)
- [ ] Implement side-by-side diff visualization
- [ ] Add Save/Reject buttons with promise-based flow
- [ ] Write file on Save, discard on Reject
- [ ] Block tool response until user decision
- [ ] Return `FILE_SAVED` or `DIFF_REJECTED`
- [ ] Handle view close as rejection
- [ ] Add integration tests

**Done when**: Shows visual diff and blocks until user decision

---

### 10. ❌ Notification: at_mentioned

**Priority**: MEDIUM

**Notification Format**:
```typescript
interface AtMentionedParams {
  filePath: string;
  lineStart: number;
  lineEnd: number;
}
```

**Implementation**:
- [ ] Add command "Send selection to Claude"
- [ ] Get current selection with line numbers
- [ ] Emit notification via WebSocket broadcast
- [ ] Show user feedback (Notice)
- [ ] Add to command palette
- [ ] Add unit tests for notification format

**Done when**: User can explicitly send selections to Claude

---

### 11. ❌ Response Format Standardization

**Priority**: HIGH

**Implementation**:
- [ ] Create `src/mcp/response-helpers.ts`
- [ ] Add `formatToolResponse()` helper
- [ ] Add `formatErrorResponse()` helper
- [ ] Ensure all JSON stringification happens in helpers
- [ ] Refactor existing tools to use helpers
- [ ] Add tests verifying JSON parsing

**Done when**: All tool responses use centralized formatting

---

### 12. ⚠️ Tool: getDiagnostics (Enhancement)

**Priority**: LOW

**Current**: Returns basic vault info

**Implementation**:
- [ ] Keep current implementation as fallback
- [ ] Return empty diagnostics array (Obsidian has no LSP)
- [ ] Document limitation in response
- [ ] Ensure JSON-stringified format

**Done when**: Returns protocol-compliant empty diagnostics

---

### 13. ❌ Tool: executeCode

**Priority**: NOT APPLICABLE

**Reason**: Obsidian doesn't support Jupyter notebooks

**Implementation**:
- [ ] Add stub that returns "Not supported in Obsidian"
- [ ] Document in README

---

## Testing Strategy

### Unit Tests (Pure Logic)
- Response formatting helpers
- Selection caching logic
- Path normalization
- Auth token validation

### Integration Tests (Obsidian API)
- File operations
- Editor selection
- Workspace navigation
- View lifecycle

### End-to-End Tests
- WebSocket authentication flow
- Tool invocation and responses
- Diff view user interaction
- Selection notifications

## Documentation Updates

- [ ] README.md - List all supported tools
- [ ] Authentication setup guide
- [ ] Tool usage examples
- [ ] Limitations section (no Jupyter, no LSP)
- [ ] CHANGELOG.md with breaking changes

## Release Checklist

- [ ] All tests passing
- [ ] Manual testing on macOS, Windows, Linux
- [ ] Version bump in manifest.json
- [ ] Conventional commit messages
- [ ] GitHub release with notes

## Notes

- **File Diff Integration**: Can reuse UI patterns from obsidian-file-diff plugin
- **JSON Stringification**: Critical for VS Code compatibility
- **Error Handling**: Never return null/undefined silently (per C-10)
- **Obsidian Limitations**: No LSP diagnostics, no Jupyter, different tab model