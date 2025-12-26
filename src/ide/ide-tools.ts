import { App, TFile, WorkspaceLeaf } from "obsidian";
import { McpReplyFunction } from "../mcp/types";
import { ToolImplementation, ToolDefinition } from "../shared/tool-registry";
import { formatToolResponse, formatErrorResponse, ErrorCodes } from "../mcp/response-helpers";
import { DiffView, DIFF_VIEW_TYPE } from "./diff-view";

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
		description: "Open a diff view (stub implementation for Obsidian compatibility)",
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

	createImplementations(): ToolImplementation[] {
		return [
			{
				name: "openFile",
				handler: async (args: any, reply: McpReplyFunction) => {
					try {
						const { filePath, preview, startText, endText, selectToEndOfLine, makeFrontmost = true } = args;
						
						// Normalize the file path
						const normalizedPath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
						
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
						
						// Determine the operation type and validate parameters
						let normalizedOldPath: string;
						let normalizedNewPath: string;
						
						if (!old_file_path && !new_file_path) {
							return reply({
								error: formatErrorResponse(
									ErrorCodes.INVALID_PARAMS,
									"At least one of old_file_path or new_file_path must be provided"
								),
							});
						}
						
						// Handle different operation types
						if (!old_file_path && new_file_path) {
							// Create new file
							if (new_file_contents === null || new_file_contents === undefined) {
								return reply({
									error: formatErrorResponse(
										ErrorCodes.INVALID_PARAMS,
										"new_file_contents is required when creating a new file"
									),
								});
							}
							normalizedOldPath = new_file_path.startsWith("/") ? new_file_path.substring(1) : new_file_path;
							normalizedNewPath = normalizedOldPath;
						} else if (old_file_path && !new_file_path) {
							// Edit or delete existing file
							normalizedOldPath = old_file_path.startsWith("/") ? old_file_path.substring(1) : old_file_path;
							normalizedNewPath = normalizedOldPath;
						} else {
							// Move/rename or edit with explicit paths
							normalizedOldPath = old_file_path.startsWith("/") ? old_file_path.substring(1) : old_file_path;
							normalizedNewPath = new_file_path.startsWith("/") ? new_file_path.substring(1) : new_file_path;
						}
						
					console.debug(`[MCP] OpenDiff requested - old: ${old_file_path}, new: ${new_file_path}, tab: ${tab_name}`);
					
					// Close any existing diff views
					this.app.workspace.detachLeavesOfType(DIFF_VIEW_TYPE);
					
					// Get or open the file being edited to provide context for the diff
					let leaf: WorkspaceLeaf | null = null;
					
					// Try to find a markdown leaf that's already editing the relevant file
					const fileLeaves = this.app.workspace.getLeavesOfType('markdown');
					for (const fileLeaf of fileLeaves) {
						const file = (fileLeaf.view as any).file;
						if (file && (file.path === normalizedOldPath || file.path === normalizedNewPath)) {
							leaf = fileLeaf;
							break;
						}
					}
					
					// If the file isn't open, try to open it first
					if (!leaf) {
						const targetPath = normalizedNewPath || normalizedOldPath;
						const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
						
						if (targetFile && targetFile instanceof TFile) {
							// Get a leaf from the main panel (rootSplit), not sidebars
							leaf = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
							if (!leaf) {
								leaf = this.app.workspace.getLeaf('tab');
							}
							await leaf.openFile(targetFile);
						} else {
							// File doesn't exist yet, use most recent markdown leaf from main panel
							leaf = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
							if (!leaf) {
								// No leaf in main panel, create one
								leaf = this.app.workspace.getLeaf('tab');
							}
						}
					}
						
						// Create the view with state
						const view = new DiffView(leaf, {
							oldFilePath: normalizedOldPath,
							newFilePath: normalizedNewPath,
							newFileContents: new_file_contents || '',
							tabName: tab_name || 'Diff View'
						});
						
						// Set the view on the leaf
						leaf.open(view);
						
						// Make the leaf active
						this.app.workspace.setActiveLeaf(leaf, { focus: true });
						
						// Wait for user decision
						const decision = await view.getUserDecision();
						
						// Return the decision
						return reply({
							result: formatToolResponse(decision),
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
