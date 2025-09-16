import { App } from "obsidian";
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
						
						// Create a new leaf for the diff view
						const leaf = this.app.workspace.getLeaf('tab');
						
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
		];
	}
}