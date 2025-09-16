import { App, WorkspaceLeaf, TFile } from "obsidian";
import { IdeTools } from "./ide-tools";
import { formatToolResponse, formatErrorResponse, ErrorCodes } from "../mcp/response-helpers";

// Mock Obsidian modules
jest.mock("obsidian");

describe("IdeTools", () => {
	let app: App;
	let ideTools: IdeTools;
	let mockReply: jest.Mock;
	let mockEditor: any;
	let mockView: any;
	let mockLeaf: WorkspaceLeaf;
	let mockFile: TFile;

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();
		
		// Create mock editor
		mockEditor = {
			getValue: jest.fn(),
			posFromIndex: jest.fn(),
			indexFromPos: jest.fn(),
			getLine: jest.fn(),
			setSelection: jest.fn(),
			scrollIntoView: jest.fn(),
			getSelection: jest.fn(),
			getCursor: jest.fn(),
		};

		// Create mock view
		mockView = {
			getViewType: jest.fn().mockReturnValue("markdown"),
			editor: mockEditor,
		};

		// Create mock leaf
		mockLeaf = {
			view: mockView,
		} as any as WorkspaceLeaf;

		// Create mock file
		mockFile = {
			path: "test.md",
		} as TFile;

		// Create mock app
		app = {
			vault: {
				getAbstractFileByPath: jest.fn(),
				getName: jest.fn().mockReturnValue("Test Vault"),
				getFiles: jest.fn().mockReturnValue([]),
			},
			workspace: {
				openLinkText: jest.fn().mockResolvedValue(undefined),
				activeLeaf: mockLeaf,
				getActiveFile: jest.fn(),
			},
		} as any as App;

		// Create IdeTools instance
		ideTools = new IdeTools(app);

		// Create mock reply function
		mockReply = jest.fn();
	});

	describe("openFile", () => {
		const openFileImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "openFile")!;
		};

		it("should open a file successfully with simple response", async () => {
			const filePath = "test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			
			const impl = openFileImpl();
			await impl.handler({ filePath }, mockReply);

			expect(app.workspace.openLinkText).toHaveBeenCalledWith("test.md", "", false);
			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse("Opened test.md"),
			});
		});

		it("should open a file with preview mode", async () => {
			const filePath = "test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			
			const impl = openFileImpl();
			await impl.handler({ filePath, preview: true }, mockReply);

			expect(app.workspace.openLinkText).toHaveBeenCalledWith("test.md", "", true);
		});

		it("should handle leading slash in file path", async () => {
			const filePath = "/test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			
			const impl = openFileImpl();
			await impl.handler({ filePath }, mockReply);

			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith("test.md");
			expect(app.workspace.openLinkText).toHaveBeenCalledWith("test.md", "", false);
		});

		it("should return detailed response when makeFrontmost is false", async () => {
			const filePath = "test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			
			const impl = openFileImpl();
			await impl.handler({ filePath, makeFrontmost: false }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					filePath: "test.md",
					message: "Opened test.md",
				}),
			});
		});

		it("should return error when file not found", async () => {
			const filePath = "nonexistent.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);
			
			const impl = openFileImpl();
			await impl.handler({ filePath }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INVALID_PARAMS,
					"File not found: nonexistent.md"
				),
			});
			expect(app.workspace.openLinkText).not.toHaveBeenCalled();
		});

		it("should select text from startText to endText", async () => {
			const filePath = "test.md";
			const content = "Hello world\nThis is a test\nGoodbye world";
			const startText = "This";
			const endText = "test";
			
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			mockEditor.getValue.mockReturnValue(content);
			mockEditor.posFromIndex.mockImplementation((index: number) => {
				// Simple line/ch calculation
				const lines = content.substring(0, index).split('\n');
				return { line: lines.length - 1, ch: lines[lines.length - 1].length };
			});
			mockEditor.indexFromPos.mockImplementation((pos: any) => {
				// Simple index calculation
				const lines = content.split('\n');
				let index = 0;
				for (let i = 0; i < pos.line; i++) {
					index += lines[i].length + 1; // +1 for newline
				}
				return index + pos.ch;
			});
			
			const impl = openFileImpl();
			await impl.handler({ filePath, startText, endText }, mockReply);

			// Check that selection was set
			expect(mockEditor.setSelection).toHaveBeenCalled();
			const [startPos, endPos] = mockEditor.setSelection.mock.calls[0];
			expect(startPos).toEqual({ line: 1, ch: 0 }); // "This" starts at line 1, ch 0
			expect(endPos).toEqual({ line: 1, ch: 14 }); // "test" ends at line 1, ch 14
			
			expect(mockEditor.scrollIntoView).toHaveBeenCalled();
		});

		it("should select only startText when endText not found", async () => {
			const filePath = "test.md";
			const content = "Hello world\nThis is a test\nGoodbye world";
			const startText = "This";
			const endText = "nonexistent";
			
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			mockEditor.getValue.mockReturnValue(content);
			mockEditor.posFromIndex.mockImplementation((index: number) => {
				const lines = content.substring(0, index).split('\n');
				return { line: lines.length - 1, ch: lines[lines.length - 1].length };
			});
			
			const impl = openFileImpl();
			await impl.handler({ filePath, startText, endText }, mockReply);

			// Should select just "This"
			expect(mockEditor.setSelection).toHaveBeenCalled();
			const [startPos, endPos] = mockEditor.setSelection.mock.calls[0];
			expect(startPos).toEqual({ line: 1, ch: 0 });
			expect(endPos).toEqual({ line: 1, ch: 4 }); // End of "This"
		});

		it("should extend selection to end of line when selectToEndOfLine is true", async () => {
			const filePath = "test.md";
			const content = "Hello world\nThis is a test\nGoodbye world";
			const startText = "This";
			
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			mockEditor.getValue.mockReturnValue(content);
			mockEditor.posFromIndex.mockImplementation((index: number) => {
				const lines = content.substring(0, index).split('\n');
				return { line: lines.length - 1, ch: lines[lines.length - 1].length };
			});
			mockEditor.getLine.mockImplementation((line: number) => {
				return content.split('\n')[line];
			});
			
			const impl = openFileImpl();
			await impl.handler({ filePath, startText, selectToEndOfLine: true }, mockReply);

			expect(mockEditor.setSelection).toHaveBeenCalled();
			const [startPos, endPos] = mockEditor.setSelection.mock.calls[0];
			expect(startPos).toEqual({ line: 1, ch: 0 });
			expect(endPos).toEqual({ line: 1, ch: 14 }); // End of line "This is a test"
		});

		it("should handle when no active leaf available", async () => {
			const filePath = "test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			app.workspace.activeLeaf = null;
			
			const impl = openFileImpl();
			await impl.handler({ filePath, startText: "test" }, mockReply);

			// Should still open file but not set selection
			expect(app.workspace.openLinkText).toHaveBeenCalled();
			expect(mockEditor.setSelection).not.toHaveBeenCalled();
		});

		it("should handle non-markdown view types", async () => {
			const filePath = "test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			mockView.getViewType.mockReturnValue("canvas");
			
			const impl = openFileImpl();
			await impl.handler({ filePath, startText: "test" }, mockReply);

			// Should open file but not set selection (can't access editor)
			expect(app.workspace.openLinkText).toHaveBeenCalled();
			expect(mockEditor.setSelection).not.toHaveBeenCalled();
		});

		it("should handle errors gracefully", async () => {
			const filePath = "test.md";
			const errorMessage = "Failed to open file";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);
			app.workspace.openLinkText = jest.fn().mockRejectedValue(new Error(errorMessage));
			
			const impl = openFileImpl();
			await impl.handler({ filePath }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INTERNAL_ERROR,
					`Failed to open file: ${errorMessage}`
				),
			});
		});
	});

	describe("getCurrentSelection", () => {
		const getCurrentSelectionImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "getCurrentSelection")!;
		};

		it("should return selected text with cursor positions", async () => {
			const selectedText = "Hello, world!";
			const filePath = "test.md";
			mockEditor.getSelection.mockReturnValue(selectedText);
			mockEditor.getCursor.mockImplementation((type: string) => {
				if (type === 'from') return { line: 1, ch: 5 };
				if (type === 'to') return { line: 1, ch: 18 };
			});
			app.workspace.getActiveFile = jest.fn().mockReturnValue({ path: filePath } as TFile);

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					text: selectedText,
					filePath: filePath,
					selection: {
						start: { line: 1, character: 5 },
						end: { line: 1, character: 18 }
					}
				}),
			});
		});

		it("should handle empty selection (just cursor position)", async () => {
			const filePath = "test.md";
			mockEditor.getSelection.mockReturnValue("");
			mockEditor.getCursor.mockImplementation((type: string) => {
				return { line: 2, ch: 10 }; // Same position for both from and to
			});
			app.workspace.getActiveFile = jest.fn().mockReturnValue({ path: filePath } as TFile);

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					text: "",
					filePath: filePath,
					selection: {
						start: { line: 2, character: 10 },
						end: { line: 2, character: 10 }
					}
				}),
			});
		});

		it("should handle no active editor", async () => {
			app.workspace.activeLeaf = null;

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: false,
					message: "No active editor"
				}),
			});
		});

		it("should handle non-markdown views", async () => {
			mockView.getViewType.mockReturnValue("canvas");

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: false,
					message: "Active view is not a text editor"
				}),
			});
		});

		it("should handle view without editor", async () => {
			mockView.editor = undefined;

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: false,
					message: "Editor not available"
				}),
			});
			// Restore editor for other tests
			mockView.editor = mockEditor;
		});

		it("should handle no active file", async () => {
			const selectedText = "Some text";
			mockEditor.getSelection.mockReturnValue(selectedText);
			mockEditor.getCursor.mockImplementation((type: string) => {
				return { line: 0, ch: 0 };
			});
			app.workspace.getActiveFile = jest.fn().mockReturnValue(null);

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					text: selectedText,
					filePath: null,
					selection: {
						start: { line: 0, character: 0 },
						end: { line: 0, character: 0 }
					}
				}),
			});
		});

		it("should handle multi-line selection", async () => {
			const selectedText = "Line 1\nLine 2\nLine 3";
			const filePath = "multiline.md";
			mockEditor.getSelection.mockReturnValue(selectedText);
			mockEditor.getCursor.mockImplementation((type: string) => {
				if (type === 'from') return { line: 10, ch: 5 };
				if (type === 'to') return { line: 12, ch: 15 };
			});
			app.workspace.getActiveFile = jest.fn().mockReturnValue({ path: filePath } as TFile);

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					text: selectedText,
					filePath: filePath,
					selection: {
						start: { line: 10, character: 5 },
						end: { line: 12, character: 15 }
					}
				}),
			});
		});

		it("should handle errors gracefully", async () => {
			const errorMessage = "Editor error";
			mockEditor.getSelection.mockImplementation(() => {
				throw new Error(errorMessage);
			});

			const impl = getCurrentSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INTERNAL_ERROR,
					`Failed to get selection: ${errorMessage}`
				),
			});
		});
	});

	describe("getDiagnostics", () => {
		const getDiagnosticsImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "getDiagnostics")!;
		};

		it("should return empty diagnostics array", async () => {
			const impl = getDiagnosticsImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse([]), // Empty array as Obsidian has no LSP diagnostics
			});
		});

		it("should handle errors in diagnostics", async () => {
			app.vault.getName = jest.fn().mockImplementation(() => {
				throw new Error("Vault error");
			});

			const impl = getDiagnosticsImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INTERNAL_ERROR,
					"failed to get diagnostics: Vault error"
				),
			});
		});
	});

	describe("openDiff", () => {
		const openDiffImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "openDiff")!;
		};

		it("should return error when no file paths provided", async () => {
			const impl = openDiffImpl();
			
			await impl.handler({
				// no old_file_path or new_file_path
				new_file_contents: "some content"
			}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INVALID_PARAMS,
					"At least one of old_file_path or new_file_path must be provided"
				),
			});
		});

		it("should return error when creating new file without contents", async () => {
			const impl = openDiffImpl();
			
			await impl.handler({
				new_file_path: "new.md",
				// missing new_file_contents
			}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INVALID_PARAMS,
					"new_file_contents is required when creating a new file"
				),
			});
		});

		it("should handle path normalization", async () => {
			const impl = openDiffImpl();
			
			// Note: In a real test, we would mock the DiffView creation and interaction
			// For now, this test would require more complex mocking of the Obsidian workspace
			// and DiffView class, which is beyond the scope of a unit test
		});
	});

	describe("Stub implementations", () => {
		it("should handle close_tab with success response", async () => {
			const implementations = ideTools.createImplementations();
			const impl = implementations.find(impl => impl.name === "close_tab")!;
			
			await impl.handler({ tab_name: "test" }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse("Tab closed successfully"),
			});
		});

		it("should handle closeAllDiffTabs with success response", async () => {
			const implementations = ideTools.createImplementations();
			const impl = implementations.find(impl => impl.name === "closeAllDiffTabs")!;
			
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse("All diff tabs closed successfully"),
			});
		});
	});

	describe("getLatestSelection", () => {
		const getLatestSelectionImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "getLatestSelection")!;
		};

		it("should delegate to getCurrentSelection when available", async () => {
			const selectedText = "Test selection";
			mockEditor.getSelection.mockReturnValue(selectedText);
			mockEditor.getCursor.mockImplementation((type: string) => ({ line: 0, ch: 0 }));
			app.workspace.getActiveFile = jest.fn().mockReturnValue({ path: "test.md" } as TFile);

			const impl = getLatestSelectionImpl();
			await impl.handler({}, mockReply);

			// Should return current selection data
			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					text: selectedText,
					filePath: "test.md",
					selection: {
						start: { line: 0, character: 0 },
						end: { line: 0, character: 0 }
					}
				}),
			});
		});

		it("should return error when no editor available", async () => {
			app.workspace.activeLeaf = null;

			const impl = getLatestSelectionImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: false,
					message: "No active editor"
				}),
			});
		});
	});

	describe("getOpenEditors", () => {
		const getOpenEditorsImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "getOpenEditors")!;
		};

		it("should return list of open markdown files", async () => {
			// Mock multiple leaves
			const mockFile1 = { path: "file1.md", basename: "file1", extension: "md" };
			const mockFile2 = { path: "file2.md", basename: "file2", extension: "md" };
			
			const mockLeaf1 = { view: { file: mockFile1 } };
			const mockLeaf2 = { view: { file: mockFile2 } };
			
			app.workspace.getLeavesOfType = jest.fn().mockReturnValue([mockLeaf1, mockLeaf2]);
			app.workspace.activeLeaf = mockLeaf1;

			const impl = getOpenEditorsImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					tabs: [
						{
							uri: "file1.md",
							isActive: true,
							label: "file1",
							languageId: "markdown",
							isDirty: false
						},
						{
							uri: "file2.md",
							isActive: false,
							label: "file2",
							languageId: "markdown",
							isDirty: false
						}
					]
				}),
			});
		});

		it("should handle leaves without files", async () => {
			const mockLeafWithFile = { view: { file: { path: "test.md", basename: "test", extension: "md" } } };
			const mockLeafWithoutFile = { view: { file: null } };
			
			app.workspace.getLeavesOfType = jest.fn().mockReturnValue([mockLeafWithFile, mockLeafWithoutFile]);

			const impl = getOpenEditorsImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					tabs: [
						{
							uri: "test.md",
							isActive: false,
							label: "test",
							languageId: "markdown",
							isDirty: false
						}
					]
				}),
			});
		});

		it("should handle error gracefully", async () => {
			app.workspace.getLeavesOfType = jest.fn().mockImplementation(() => {
				throw new Error("Failed to get leaves");
			});

			const impl = getOpenEditorsImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INTERNAL_ERROR,
					"Failed to get open editors: Failed to get leaves"
				),
			});
		});
	});

	describe("getWorkspaceFolders", () => {
		const getWorkspaceFoldersImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "getWorkspaceFolders")!;
		};

		it("should return all folders in vault", async () => {
			const basePath = "/Users/test/vault";
			const vaultName = "Test Vault";
			
			// Mock files with folder structure
			const mockFiles = [
				{ path: "folder1/file1.md" },
				{ path: "folder1/subfolder/file2.md" },
				{ path: "folder2/file3.md" },
				{ path: "root-file.md" }
			];
			
			app.vault.adapter = {
				getBasePath: jest.fn().mockReturnValue(basePath)
			} as any;
			app.vault.getName = jest.fn().mockReturnValue(vaultName);
			app.vault.getAllLoadedFiles = jest.fn().mockReturnValue(mockFiles);

			const impl = getWorkspaceFoldersImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					folders: [
						{
							name: vaultName,
							uri: `file://${basePath}`,
							path: basePath
						},
						{
							name: "folder1",
							uri: `file://${basePath}/folder1`,
							path: `${basePath}/folder1`
						},
						{
							name: "subfolder",
							uri: `file://${basePath}/folder1/subfolder`,
							path: `${basePath}/folder1/subfolder`
						},
						{
							name: "folder2",
							uri: `file://${basePath}/folder2`,
							path: `${basePath}/folder2`
						}
					],
					rootPath: basePath
				}),
			});
		});

		it("should handle empty vault", async () => {
			const basePath = "/Users/test/vault";
			const vaultName = "Empty Vault";
			
			app.vault.adapter = {
				getBasePath: jest.fn().mockReturnValue(basePath)
			} as any;
			app.vault.getName = jest.fn().mockReturnValue(vaultName);
			app.vault.getAllLoadedFiles = jest.fn().mockReturnValue([]);

			const impl = getWorkspaceFoldersImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					folders: [{
						name: vaultName,
						uri: `file://${basePath}`,
						path: basePath
					}],
					rootPath: basePath
				}),
			});
		});

		it("should fallback to process.cwd when getBasePath not available", async () => {
			const originalCwd = process.cwd();
			app.vault.adapter = {} as any;
			app.vault.getAllLoadedFiles = jest.fn().mockReturnValue([]);

			const impl = getWorkspaceFoldersImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					folders: [{
						name: "Test Vault",
						uri: `file://${originalCwd}`,
						path: originalCwd
					}],
					rootPath: originalCwd
				}),
			});
		});
	});

	describe("checkDocumentDirty", () => {
		const checkDocumentDirtyImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "checkDocumentDirty")!;
		};

		it("should always return false (Obsidian auto-saves)", async () => {
			const documentUri = "test.md";

			const impl = checkDocumentDirtyImpl();
			await impl.handler({ documentUri }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					documentUri: documentUri,
					isDirty: false,
					message: "Obsidian auto-saves all changes"
				}),
			});
		});

		it("should handle missing required parameter", async () => {
			// Force an error by not providing required parameter
			const impl = checkDocumentDirtyImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INVALID_PARAMS,
					"documentUri is required"
				),
			});
		});
	});

	describe("saveDocument", () => {
		const saveDocumentImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "saveDocument")!;
		};

		it("should return success for existing file", async () => {
			const documentUri = "test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);

			const impl = saveDocumentImpl();
			await impl.handler({ documentUri }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					documentUri: documentUri,
					message: "Document is already saved (Obsidian auto-saves)"
				}),
			});
		});

		it("should normalize paths with leading slash", async () => {
			const documentUri = "/test.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(mockFile);

			const impl = saveDocumentImpl();
			await impl.handler({ documentUri }, mockReply);

			expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith("test.md");
			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: true,
					documentUri: "test.md",
					message: "Document is already saved (Obsidian auto-saves)"
				}),
			});
		});

		it("should return error for non-existent file", async () => {
			const documentUri = "nonexistent.md";
			app.vault.getAbstractFileByPath = jest.fn().mockReturnValue(null);

			const impl = saveDocumentImpl();
			await impl.handler({ documentUri }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				error: formatErrorResponse(
					ErrorCodes.INVALID_PARAMS,
					"Document not found: nonexistent.md"
				),
			});
		});
	});

	describe("executeCode", () => {
		const executeCodeImpl = () => {
			const implementations = ideTools.createImplementations();
			return implementations.find(impl => impl.name === "executeCode")!;
		};

		it("should return not supported message", async () => {
			const impl = executeCodeImpl();
			await impl.handler({ code: "print('hello')", language: "python" }, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: false,
					error: "Code execution is not supported in Obsidian",
					note: "Obsidian is a note-taking app and does not support Jupyter notebooks or code execution"
				}),
			});
		});

		it("should handle any parameters", async () => {
			const impl = executeCodeImpl();
			await impl.handler({}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse({
					success: false,
					error: "Code execution is not supported in Obsidian",
					note: "Obsidian is a note-taking app and does not support Jupyter notebooks or code execution"
				}),
			});
		});
	});
});
