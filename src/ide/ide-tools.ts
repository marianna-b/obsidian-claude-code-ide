import { App, TFile, WorkspaceLeaf } from "obsidian";
import { McpReplyFunction } from "../mcp/types";
import { ToolImplementation, ToolDefinition } from "../shared/tool-registry";
import { formatToolResponse, formatErrorResponse, ErrorCodes } from "../mcp/response-helpers";
import { DiffView, DIFF_VIEW_TYPE } from "./diff-view";
import { EditorView } from '@codemirror/view';
import { showInlineDiffEffect, inlineDiffStateField } from './inline-diff/inline-diff-extension';
import { computeDiffChunks } from './inline-diff/diff-chunks';

// IDE-specific tool definitions
export const IDE_TOOL_DEFINITIONS: ToolDefinition[] = [
	{
		name: "openFile",
		description: "Open a file in Obsidian and optionally select text",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {
				filePath: {
					type: "string",
					description: "Path to the file to open",
				},
				preview: {
					type: "boolean",
					description: "Whether to open in preview mode",
				},
				startText: {
					type: "string",
					description: "Text to search for to start selection",
				},
				endText: {
					type: "string",
					description: "Text to search for to end selection",
				},
				selectToEndOfLine: {
					type: "boolean",
					description: "Whether to extend selection to end of line",
				},
				makeFrontmost: {
					type: "boolean",
					description: "Whether to return detailed response (false) or simple text (true)",
				},
			},
			required: ["filePath"],
		},
	},
	{
		name: "getCurrentSelection",
		description: "Get the currently selected text in the active editor",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "openDiff",
		description: "Show a diff view to the user for review. IMPORTANT: If this returns FILE_SAVED, the file has ALREADY been written to disk with the new contents. Do NOT attempt to write the file again or re-apply the same changes. The operation is complete.",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {
				old_file_path: {
					type: "string",
					description: "Path to the old version of the file",
				},
				new_file_path: {
					type: "string",
					description: "Path to the new version of the file",
				},
				new_file_contents: {
					type: "string",
					description: "Contents of the new file version",
				},
				tab_name: {
					type: "string",
					description: "Name of the tab to open",
				},
			},
		},
	},
	{
		name: "close_tab",
		description: "Close a tab (stub implementation for Obsidian compatibility)",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {
				tab_name: {
					type: "string",
					description: "Name of the tab to close",
				},
			},
		},
	},
	{
		name: "closeAllDiffTabs",
		description: "Close all diff tabs (stub implementation for Obsidian compatibility)",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "getDiagnostics",
		description: "Get system and vault diagnostic information",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "getLatestSelection",
		description: "Get the most recent text selection (stub - returns current selection)",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "getOpenEditors",
		description: "Get all open editor tabs",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "getWorkspaceFolders",
		description: "Get workspace folder information",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "checkDocumentDirty",
		description: "Check if a document has unsaved changes",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {
				documentUri: {
					type: "string",
					description: "URI of the document to check",
				},
			},
			required: ["documentUri"],
		},
	},
	{
		name: "saveDocument",
		description: "Save a document",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {
				documentUri: {
					type: "string",
					description: "URI of the document to save",
				},
			},
			required: ["documentUri"],
		},
	},
	{
		name: "executeCode",
		description: "Execute code (not supported in Obsidian)",
		category: "ide-specific",
		inputSchema: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description: "Code to execute",
				},
				language: {
					type: "string",
					description: "Programming language",
				},
			},
		},
	},
];

// IDE-specific tool implementations
export class IdeTools {
	constructor(private app: App) {}

	private normalizePathToVault(filePath: string): string {
		if (!filePath) return filePath;
		
		// Get the vault's base path
		const adapter = this.app.vault.adapter;
		const basePath = (adapter as any).getBasePath?.();
		
		if (basePath && filePath.startsWith(basePath)) {
			// This is an absolute filesystem path within the vault
			// Convert to vault-relative path
			let relativePath = filePath.substring(basePath.length);
			// Remove leading slash if present
			if (relativePath.startsWith('/')) {
				relativePath = relativePath.substring(1);
			}
			return relativePath;
		}
		
		// If it starts with a slash but isn't an absolute path to the vault,
		// treat it as vault-relative and remove the leading slash
		if (filePath.startsWith('/')) {
			return filePath.substring(1);
		}
		
		// Already vault-relative
		return filePath;
	}

	createImplementations(): ToolImplementation[] {
		return [
			{
				name: "openFile",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						const { filePath, preview, startText, endText, selectToEndOfLine, makeFrontmost = true } = args;
						
						// Normalize the file path
						const normalizedPath = this.normalizePathToVault(filePath);
						
						// Check if file exists
						const file = this.app.vault.getAbstractFileByPath(normalizedPath);
						if (!file || !file.hasOwnProperty('path')) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INVALID_PARAMS,
									`File not found: ${filePath}`
								),
							});
						}
						
						// Open the file
						await this.app.workspace.openLinkText(normalizedPath, "", preview || false);
						
						// Get the active leaf to access the editor
						const activeLeaf = this.app.workspace.activeLeaf;
						
						// Get the editor if we need to select text
						if ((startText || endText) && activeLeaf) {
							const view = activeLeaf.view;
							if (view.getViewType() === "markdown") {
								const editor = (view as any).editor;
								if (editor) {
									const content = editor.getValue();
									
									// Find start position
									let startPos = editor.posFromIndex(0);
									if (startText) {
										const startIndex = content.indexOf(startText);
										if (startIndex !== -1) {
											startPos = editor.posFromIndex(startIndex);
										}
									}
									
									// Find end position
									let endPos = startPos;
									if (endText) {
										const searchStart = editor.indexFromPos(startPos);
										const endIndex = content.indexOf(endText, searchStart);
										if (endIndex !== -1) {
											// Position at the end of the endText
											endPos = editor.posFromIndex(endIndex + endText.length);
										} else {
											// If endText not found, select to end of startText
											if (startText) {
												const startIndex = content.indexOf(startText);
												if (startIndex !== -1) {
													endPos = editor.posFromIndex(startIndex + startText.length);
												}
											}
										}
									}
									
									// Extend to end of line if requested
									if (selectToEndOfLine && endPos) {
										endPos = { line: endPos.line, ch: editor.getLine(endPos.line).length };
									}
									
									// Set the selection
									editor.setSelection(startPos, endPos);
									
									// Scroll to make selection visible
									editor.scrollIntoView({ from: startPos, to: endPos }, true);
								}
							}
						}
						
						// Prepare response based on makeFrontmost
						if (makeFrontmost) {
							// Simple text response
							return reply({
								result: formatToolResponse(`Opened ${filePath}`),
							});
						} else {
							// Detailed JSON response
							const response = {
								success: true,
								filePath: normalizedPath,
								message: `Opened ${filePath}`,
							};
							return reply({
								result: formatToolResponse(response),
							});
						}
					} catch (error) {
						return reply({
							error: formatErrorResponse(
								ErrorCodes.INTERNAL_ERROR,
								`Failed to open file: ${error.message}`
							),
						});
					}
				},
			},
			{
				name: "getCurrentSelection",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						// Get the active editor
						const activeLeaf = this.app.workspace.activeLeaf;
						if (!activeLeaf) {
							// No active editor
							const response = {
								success: false,
								message: "No active editor"
							};
							return reply({
								result: formatToolResponse(response),
							});
						}
						
						const view = activeLeaf.view;
						if (view.getViewType() !== "markdown") {
							// Not a markdown editor
							const response = {
								success: false,
								message: "Active view is not a text editor"
							};
							return reply({
								result: formatToolResponse(response),
							});
						}
						
						const editor = (view as any).editor;
						if (!editor) {
							// No editor available
							const response = {
								success: false,
								message: "Editor not available"
							};
							return reply({
								result: formatToolResponse(response),
							});
						}
						
						// Get the selection text
						const selectedText = editor.getSelection();
						
						// Get cursor positions
						const from = editor.getCursor('from');
						const to = editor.getCursor('to');
						
						// Get the file path
						const file = this.app.workspace.getActiveFile();
						const filePath = file ? file.path : null;
						
						// Build response
						const response = {
							success: true,
							text: selectedText || "",
							filePath: filePath,
							selection: {
								start: {
									line: from.line,
									character: from.ch
								},
								end: {
									line: to.line,
									character: to.ch
								}
							}
						};
						
						return reply({
							result: formatToolResponse(response),
						});
					} catch (error) {
						return reply({
							error: formatErrorResponse(
								ErrorCodes.INTERNAL_ERROR,
								`Failed to get selection: ${error.message}`
							),
						});
					}
				},
			},
			{
				name: "openDiff",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						const { old_file_path, new_file_path, new_file_contents, tab_name } = args || {};
						
						// Validate parameters
						if (!old_file_path && !new_file_path) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INVALID_PARAMS,
									"At least one of old_file_path or new_file_path must be provided"
								),
							});
						}
						
						// Handle file creation (no old_file_path)
						if (!old_file_path && new_file_path) {
							if (new_file_contents === null || new_file_contents === undefined) {
								return reply({
									error: formatErrorResponse(
										ErrorCodes.INVALID_PARAMS,
										"new_file_contents is required when creating a new file"
									),
								});
							}
							
							const normalizedPath = this.normalizePathToVault(new_file_path);
							
							// Create directories if needed
							const dir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
							if (dir) {
								await this.app.vault.createFolder(dir).catch(() => {});
							}
							
							// Create the file directly
							await this.app.vault.create(normalizedPath, new_file_contents);
							
							return reply({
								result: formatToolResponse(`FILE_CREATED: ${normalizedPath}`)
							});
						}
						
						// Handle file deletion (no new_file_contents)
						if (old_file_path && (!new_file_contents || new_file_contents.length === 0)) {
							const normalizedPath = this.normalizePathToVault(old_file_path);
							const fileToDelete = this.app.vault.getAbstractFileByPath(normalizedPath);
							
							if (fileToDelete && fileToDelete instanceof TFile) {
								await this.app.vault.delete(fileToDelete);
								return reply({
									result: formatToolResponse(`FILE_DELETED: ${normalizedPath}`)
								});
							} else {
								return reply({
									error: formatErrorResponse(
										ErrorCodes.INVALID_PARAMS,
										`File not found: ${normalizedPath}`
									)
								});
							}
						}
						
				// File modification - use inline diff
					const normalizedPath = this.normalizePathToVault(old_file_path || new_file_path);
					console.log('[DIFF DEBUG] Starting inline diff for:', normalizedPath);
					console.log('[DIFF DEBUG] old_file_path:', old_file_path);
					console.log('[DIFF DEBUG] new_file_path:', new_file_path);
					console.log('[DIFF DEBUG] new_file_contents length:', new_file_contents?.length);
					
					// Get the file
						const file = this.app.vault.getAbstractFileByPath(normalizedPath);
						if (!file || !(file instanceof TFile)) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INVALID_PARAMS,
									`File not found: ${normalizedPath}`
								)
							});
						}
						
				// Try to find a markdown leaf that's already editing the file
					let leaf: WorkspaceLeaf | null = null;
					const fileLeaves = this.app.workspace.getLeavesOfType('markdown');
					console.log('[DIFF DEBUG] Found markdown leaves:', fileLeaves.length);
					for (const fileLeaf of fileLeaves) {
						const leafFile = (fileLeaf.view as any).file;
						if (leafFile && leafFile.path === normalizedPath) {
							console.log('[DIFF DEBUG] Found existing leaf for file');
							leaf = fileLeaf;
							break;
						}
					}
					
					// If the file isn't already open, create a new tab in the main workspace
					if (!leaf) {
						console.log('[DIFF DEBUG] Creating new leaf');
						// Try to use an existing markdown tab's parent to create new tab
						if (fileLeaves.length > 0) {
							const referenceLeaf = fileLeaves[0];
							// Create leaf in the same parent container as markdown tabs
							const parent = referenceLeaf.parent;
							if (parent) {
								console.log('[DIFF DEBUG] Creating leaf in parent');
								leaf = this.app.workspace.createLeafInParent(parent, fileLeaves.length);
							} else {
								console.log('[DIFF DEBUG] Using getLeaf(tab)');
								leaf = this.app.workspace.getLeaf('tab');
							}
						} else {
							console.log('[DIFF DEBUG] No markdown tabs, creating split');
							// No markdown tabs exist, create a new split in the main workspace
							const rootLeaf = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
							if (rootLeaf) {
								leaf = this.app.workspace.createLeafBySplit(rootLeaf, 'vertical');
							} else {
								// Last resort fallback
								leaf = this.app.workspace.getLeaf('tab');
							}
						}
						console.log('[DIFF DEBUG] Opening file in leaf');
						await leaf.openFile(file);
					}
						
				console.log('[DIFF DEBUG] Leaf opened, getting view');
					// Get editor view
						const view = leaf.view;
						console.log('[DIFF DEBUG] View type:', view.getViewType());
						if (view.getViewType() !== 'markdown') {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INTERNAL_ERROR,
									'Not a markdown view'
								)
							});
						}
						
					const editor = (view as any).editor;
						console.log('[DIFF DEBUG] Got editor:', !!editor);
						if (!editor) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INTERNAL_ERROR,
									'No editor available'
								)
							});
						}
						
					// Get CodeMirror EditorView
						const cmEditor = (editor as any).cm as EditorView;
						console.log('[DIFF DEBUG] Got CodeMirror:', !!cmEditor);
						if (!cmEditor) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INTERNAL_ERROR,
									'CodeMirror not available'
								)
							});
						}
						
					// Read old content
						const oldContent = await this.app.vault.read(file);
						console.log('[DIFF DEBUG] Old content length:', oldContent.length);
						
					// Compute diff chunks
					const chunks = computeDiffChunks(oldContent, new_file_contents || '');
					console.log('[DIFF DEBUG] Computed chunks:', chunks.length);
					console.log('[DIFF DEBUG] Chunk details:', JSON.stringify(chunks, null, 2));
					
					// Small delay to ensure editor is fully initialized
					await new Promise(resolve => setTimeout(resolve, 100));
					
					console.log('[DIFF DEBUG] Dispatching inline diff effect');
					// Dispatch inline diff effect
					cmEditor.dispatch({
						effects: showInlineDiffEffect.of({
							filePath: normalizedPath,
							chunks: chunks,
							originalContent: oldContent,
							targetContent: new_file_contents || ''
						})
					});
					console.log('[DIFF DEBUG] Dispatch complete');
					
					// Check if state field exists and has extensions
					const state = cmEditor.state.field(inlineDiffStateField, false);
					console.log('[DIFF DEBUG] State after dispatch:', state);
					console.log('[DIFF DEBUG] Editor extensions:', cmEditor.state.facet(EditorView.decorations));
					console.log('[DIFF DEBUG] Has inline diff extension:', cmEditor.state.field(inlineDiffStateField, false) !== undefined);
						
						// Return immediately - user will interact with chunks
						return reply({
							result: formatToolResponse(`DIFF_SHOWN: ${chunks.length} ${chunks.length === 1 ? 'chunk' : 'chunks'} to review in ${normalizedPath}`)
						});
						
					} catch (error) {
						return reply({
							error: formatErrorResponse(
								ErrorCodes.INTERNAL_ERROR,
								`Failed to open diff view: ${error.message}`
							),
						});
					}
				},
			},
			{
				name: "close_tab",
				handler: async (args: any, reply: McpReplyFunction) => {
					// Claude Code is trying to close a tab, but Obsidian doesn't have the same tab concept
					// Just acknowledge the request successfully
					const { tab_name } = args || {};
					
					console.debug(`[MCP] CloseTab requested for ${tab_name}`);
					
					return reply({
						result: formatToolResponse("Tab closed successfully"),
					});
				},
			},
			{
				name: "closeAllDiffTabs",
				handler: async (args: any, reply: McpReplyFunction) => {
					// Claude Code is trying to close all diff tabs, but Obsidian doesn't have the same tab concept
					// Just acknowledge the request successfully
					console.debug(`[MCP] CloseAllDiffTabs requested`);
					
					return reply({
						result: formatToolResponse("All diff tabs closed successfully"),
					});
				},
			},
			{
				name: "getDiagnostics",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						// For Obsidian, we don't have traditional LSP diagnostics
						// but we can provide basic system/vault diagnostic information
						const diagnostics = {
							vaultName: this.app.vault.getName(),
							fileCount: this.app.vault.getFiles().length,
							activeFile: this.app.workspace.getActiveFile()?.path || null,
							timestamp: new Date().toISOString(),
						};

						// Protocol expects JSON-stringified array of diagnostics
						return reply({
							result: formatToolResponse([]), // Empty array as Obsidian has no LSP diagnostics
						});
					} catch (error) {
					reply({
						error: formatErrorResponse(
							ErrorCodes.INTERNAL_ERROR,
							`failed to get diagnostics: ${error.message}`
						),
					});
					}
				},
			},
			{
				name: "getLatestSelection",
				handler: async (args: any, reply: McpReplyFunction) => {
					// Stub implementation - just returns current selection
					// In a full implementation, this would cache selections
					const getCurrentSelectionImpl = this.createImplementations().find(impl => impl.name === "getCurrentSelection");
					if (getCurrentSelectionImpl) {
						return getCurrentSelectionImpl.handler({}, reply);
					}
					
					// Fallback
					return reply({
						result: formatToolResponse({
							success: false,
							message: "No selection history available"
						}),
					});
				},
			},
			{
				name: "getOpenEditors",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						// Get all open markdown leaves
						const leaves = this.app.workspace.getLeavesOfType('markdown');
						const activeLeaf = this.app.workspace.activeLeaf;
						
						const tabs = leaves.map(leaf => {
							const file = (leaf.view as any).file;
							if (!file) return null;
							
							const extension = file.extension || 'md';
							const languageId = extension === 'md' ? 'markdown' : extension;
							
							return {
								uri: file.path,
								isActive: leaf === activeLeaf,
								label: file.basename,
								languageId: languageId,
								isDirty: false // Obsidian auto-saves, so always false
							};
						}).filter(tab => tab !== null);
						
						return reply({
							result: formatToolResponse({ tabs }),
						});
					} catch (error) {
						return reply({
							error: formatErrorResponse(
								ErrorCodes.INTERNAL_ERROR,
								`Failed to get open editors: ${error.message}`
							),
						});
					}
				},
			},
			{
				name: "getWorkspaceFolders",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						const adapter = this.app.vault.adapter;
						const basePath = (adapter as any).getBasePath?.() || process.cwd();
						const vaultName = this.app.vault.getName();
						
						// Get all folders in the vault
						const allFiles = this.app.vault.getAllLoadedFiles();
						const folderPaths = new Set<string>();
						
						// Add root folder
						folderPaths.add('');
						
						// Collect all folder paths
						allFiles.forEach(file => {
							if (file.path && file.path.includes('/')) {
								// Add all parent folders
								const parts = file.path.split('/');
								for (let i = 1; i <= parts.length - 1; i++) {
									folderPaths.add(parts.slice(0, i).join('/'));
								}
							}
						});
						
						// Convert to array and create folder objects
						const folders = Array.from(folderPaths).sort().map(folderPath => {
							const name = folderPath === '' ? vaultName : folderPath.split('/').pop() || folderPath;
							const fullPath = folderPath === '' ? basePath : `${basePath}/${folderPath}`;
							return {
								name: name,
								uri: `file://${fullPath}`,
								path: fullPath
							};
						});
						
						const response = {
							success: true,
							folders: folders,
							rootPath: basePath
						};
						
						return reply({
							result: formatToolResponse(response),
						});
					} catch (error) {
						return reply({
							error: formatErrorResponse(
								ErrorCodes.INTERNAL_ERROR,
								`Failed to get workspace folders: ${error.message}`
							),
						});
					}
				},
			},
			{
				name: "checkDocumentDirty",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						const { documentUri } = args;
						
						if (!documentUri) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INVALID_PARAMS,
									"documentUri is required"
								),
							});
						}
						
						// Obsidian auto-saves, so documents are never dirty
						const response = {
							success: true,
							documentUri: documentUri,
							isDirty: false,
							message: "Obsidian auto-saves all changes"
						};
						
						return reply({
							result: formatToolResponse(response),
						});
					} catch (error) {
						return reply({
							error: formatErrorResponse(
								ErrorCodes.INTERNAL_ERROR,
								`Failed to check document dirty state: ${error.message}`
							),
						});
					}
				},
			},
			{
				name: "saveDocument",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						const { documentUri } = args;
						
						// Normalize the path
						const normalizedPath = documentUri.startsWith("/") ? documentUri.substring(1) : documentUri;
						
						// Check if file exists
						const file = this.app.vault.getAbstractFileByPath(normalizedPath);
						if (!file) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INVALID_PARAMS,
									`Document not found: ${documentUri}`
								),
							});
						}
						
						// Obsidian auto-saves, so just return success
						const response = {
							success: true,
							documentUri: normalizedPath,
							message: "Document is already saved (Obsidian auto-saves)"
						};
						
						return reply({
							result: formatToolResponse(response),
						});
					} catch (error) {
						return reply({
							error: formatErrorResponse(
								ErrorCodes.INTERNAL_ERROR,
								`Failed to save document: ${error.message}`
							),
						});
					}
				},
			},
			{
				name: "executeCode",
				handler: async (args: any, reply: McpReplyFunction) => {
					// Not supported in Obsidian
					const response = {
						success: false,
						error: "Code execution is not supported in Obsidian",
						note: "Obsidian is a note-taking app and does not support Jupyter notebooks or code execution"
					};
					
					return reply({
						result: formatToolResponse(response),
					});
				},
			},
		];
	}
}
