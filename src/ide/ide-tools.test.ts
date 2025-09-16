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

	describe("Stub implementations", () => {
		it("should handle openDiff with success response", async () => {
			const implementations = ideTools.createImplementations();
			const impl = implementations.find(impl => impl.name === "openDiff")!;
			
			await impl.handler({
				old_file_path: "old.md",
				new_file_path: "new.md",
				new_file_contents: "content",
				tab_name: "diff",
			}, mockReply);

			expect(mockReply).toHaveBeenCalledWith({
				result: formatToolResponse("Diff view opened in Obsidian (no visual diff available)"),
			});
		});

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
});