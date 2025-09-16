# Claude Code IDE Integration - API Design

## Overview

This document defines TypeScript interfaces and design decisions for implementing missing Claude Code IDE features.

## Core Response Helpers

These helpers ensure consistent response formatting across all tools.

```typescript
// src/mcp/response-helpers.ts

export interface ToolResponse<T = any> {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export interface ErrorResponse {
  code: number;
  message: string;
}

export function formatToolResponse(data: any): ToolResponse {
  return {
    content: [{
      type: "text",
      text: typeof data === "string" ? data : JSON.stringify(data)
    }]
  };
}

export function formatErrorResponse(code: number, message: string): ErrorResponse {
  return {
    code,
    message
  };
}
```

## Tool Interfaces

### 1. OpenFile

```typescript
interface OpenFileParams {
  filePath: string;
  preview?: boolean;
  startText?: string;
  endText?: string;
  selectToEndOfLine?: boolean;
  makeFrontmost?: boolean;
}

interface OpenFileResponse {
  // When makeFrontmost = true
  text: string; // "Opened file: /path/to/file.js"
  
  // When makeFrontmost = false
  success: boolean;
  filePath: string;
  languageId: string;
  lineCount: number;
}
```

### 2. GetCurrentSelection

```typescript
interface GetCurrentSelectionResponse {
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

### 3. GetLatestSelection

```typescript
// Same as GetCurrentSelectionResponse
type GetLatestSelectionResponse = GetCurrentSelectionResponse;
```

### 4. GetOpenEditors

```typescript
interface GetOpenEditorsResponse {
  tabs: Array<{
    uri: string;
    isActive: boolean;
    label: string;
    languageId: string;
    isDirty: boolean;
  }>;
}
```

### 5. GetWorkspaceFolders

```typescript
interface GetWorkspaceFoldersResponse {
  success: boolean;
  folders: Array<{
    name: string;
    uri: string;
    path: string;
  }>;
  rootPath: string;
}
```

### 6. CheckDocumentDirty

```typescript
interface CheckDocumentDirtyParams {
  filePath: string;
}

interface CheckDocumentDirtyResponse {
  success: boolean;
  filePath: string;
  isDirty: boolean;
  isUntitled: boolean;
  message?: string; // For error case
}
```

### 7. SaveDocument

```typescript
interface SaveDocumentParams {
  filePath: string;
}

interface SaveDocumentResponse {
  success: boolean;
  filePath: string;
  saved: boolean;
  message: string;
}
```

### 8. OpenDiff

```typescript
interface OpenDiffParams {
  old_file_path: string;
  new_file_path: string;
  new_file_contents: string;
  tab_name: string;
}

// Response is plain text: "FILE_SAVED" or "DIFF_REJECTED"
type OpenDiffResponse = "FILE_SAVED" | "DIFF_REJECTED";
```

## Notification Interfaces

### AtMentioned

```typescript
interface AtMentionedNotification {
  jsonrpc: "2.0";
  method: "at_mentioned";
  params: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
  };
}
```

## DiffView Lifecycle Design

```typescript
// src/ide/diff-view.ts

export const DIFF_VIEW_TYPE = "claude-code-diff-view";

export interface DiffViewState {
  oldFilePath: string;
  newFilePath: string;
  newFileContents: string;
  tabName: string;
  resolveCallback: (result: "FILE_SAVED" | "DIFF_REJECTED") => void;
}

export class ClaudeCodeDiffView extends ItemView {
  private state: DiffViewState;
  
  async onClose(): Promise<void> {
    // If closed without decision, treat as rejection
    this.state.resolveCallback("DIFF_REJECTED");
  }
  
  private async onSave(): Promise<void> {
    // Write file and resolve
    await this.app.vault.adapter.write(
      this.state.newFilePath, 
      this.state.newFileContents
    );
    this.state.resolveCallback("FILE_SAVED");
    this.leaf.detach();
  }
  
  private onReject(): void {
    // Just resolve without saving
    this.state.resolveCallback("DIFF_REJECTED");
    this.leaf.detach();
  }
}
```

## Selection Caching Design

```typescript
// src/obsidian/workspace-manager.ts additions

interface CachedSelection {
  text: string;
  filePath: string;
  selection: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  timestamp: number;
}

export class WorkspaceManager {
  private lastSelection: CachedSelection | null = null;
  
  private updateSelectionCache(selection: CachedSelection): void {
    this.lastSelection = {
      ...selection,
      timestamp: Date.now()
    };
  }
  
  public getLastSelection(): CachedSelection | null {
    return this.lastSelection;
  }
}
```

## WebSocket Authentication Design

```typescript
// src/mcp/server.ts modifications

interface AuthenticatedWebSocket extends WebSocket {
  isAuthenticated: boolean;
}

private async handleUpgrade(request: IncomingMessage, socket: Socket): Promise<void> {
  const authToken = request.headers['x-claude-code-ide-authorization'] as string;
  
  if (!authToken || authToken !== this.lockFileAuthToken) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  
  // Continue with normal upgrade...
}
```

## Design Decisions & Alternatives

### 1. Response Format (BP-3)

**Chosen**: Centralized helpers with JSON stringification
- **Pros**: Consistent format, single source of truth, easy testing
- **Cons**: Extra abstraction layer

**Alternative**: Inline formatting in each tool
- **Pros**: More direct, less abstraction
- **Cons**: Inconsistent formatting, harder to maintain

### 2. Diff View Implementation (BP-3)

**Chosen**: Custom ItemView with promise-based blocking
- **Pros**: Full control, exact protocol compliance, no dependencies
- **Cons**: More code to maintain

**Alternative**: Fork/extend obsidian-file-diff
- **Pros**: Reuse existing code
- **Cons**: Dependency management, feature mismatch, licensing

### 3. Selection Caching (BP-3)

**Chosen**: In-memory cache in WorkspaceManager
- **Pros**: Simple, fast, sufficient for session
- **Cons**: Lost on plugin reload

**Alternative**: Persist to disk
- **Pros**: Survives reloads
- **Cons**: Complexity, cleanup needed, privacy concerns

## Implementation Order

Based on priority and dependencies:

1. **Response Format Helpers** (Foundation)
2. **WebSocket Authentication** (Security)
3. **openFile Tool** (Core functionality)
4. **getCurrentSelection Tool** (Core functionality)
5. **openDiff Implementation** (Critical for Claude)
6. **getLatestSelection Tool** (Builds on selection tracking)
7. **getOpenEditors Tool** (Workspace info)
8. **getWorkspaceFolders Tool** (Workspace info)
9. **at_mentioned Notification** (User interaction)
10. **checkDocumentDirty Tool** (Nice to have)
11. **saveDocument Tool** (Nice to have)

## Assumptions (BP-6)

1. **File paths are always relative to vault root** - Confirmed by existing code
2. **Only one active editor at a time** - Obsidian's model
3. **Editor is available when file is open** - Verified in workspace-manager.ts
4. **WebSocket auth token is available in lock file** - Existing implementation
5. **Diff library is available** - Need to add as dependency
6. **User decisions on diff are final** - No undo after Save/Reject
7. **Selection cache doesn't need persistence** - Session-only is sufficient