import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { diffLines, Change } from 'diff';

export const DIFF_VIEW_TYPE = 'claude-code-diff-view';

interface DiffViewState {
	oldFilePath: string;
	newFilePath: string;
	newFileContents: string;
	tabName: string;
}

export class DiffView extends ItemView {
	private state: DiffViewState;
	private resolvePromise: ((value: 'FILE_SAVED' | 'DIFF_REJECTED') => void) | null = null;
	private userDecisionPromise: Promise<'FILE_SAVED' | 'DIFF_REJECTED'>;

	constructor(leaf: WorkspaceLeaf, state: DiffViewState) {
		super(leaf);
		this.state = state;
		
		// Create a promise that will be resolved when the user makes a decision
		this.userDecisionPromise = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}

	getViewType(): string {
		return DIFF_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.state.tabName || 'Diff View';
	}

	getIcon(): string {
		return 'git-compare';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		
		// Create main container
		const mainContainer = container.createDiv({ cls: 'claude-diff-view' });
		
		// Create header
		const header = mainContainer.createDiv({ cls: 'diff-header' });
		
		// Determine the operation type
		let headerText = '';
		if (!this.state.newFileContents || this.state.newFileContents.length === 0) {
			headerText = `Delete: ${this.state.oldFilePath}`;
		} else if (this.state.oldFilePath !== this.state.newFilePath) {
			headerText = `Move/Rename: ${this.state.oldFilePath} → ${this.state.newFilePath}`;
		} else {
			const fileExists = this.app.vault.getAbstractFileByPath(this.state.oldFilePath);
			headerText = fileExists ? `Edit: ${this.state.oldFilePath}` : `Create: ${this.state.newFilePath}`;
		}
		
		header.createEl('h3', { text: headerText });
		
		// Create buttons container
		const buttonsContainer = header.createDiv({ cls: 'diff-buttons' });
		
		// Determine button text based on operation
		let acceptButtonText = 'Save Changes';
		let rejectButtonText = 'Cancel';
		
		if (!this.state.newFileContents || this.state.newFileContents.length === 0) {
			acceptButtonText = 'Delete File';
			rejectButtonText = 'Keep File';
		} else if (this.state.oldFilePath !== this.state.newFilePath) {
			const oldExists = this.app.vault.getAbstractFileByPath(this.state.oldFilePath);
			acceptButtonText = oldExists ? 'Move/Rename File' : 'Create File';
		} else {
			const fileExists = this.app.vault.getAbstractFileByPath(this.state.oldFilePath);
			acceptButtonText = fileExists ? 'Save Changes' : 'Create File';
		}
		
		// Save button
		const saveBtn = buttonsContainer.createEl('button', {
			text: acceptButtonText,
			cls: 'mod-cta'
		});
		saveBtn.addEventListener('click', () => this.handleSave());
		
		// Reject button
		const rejectBtn = buttonsContainer.createEl('button', {
			text: rejectButtonText,
			cls: 'mod-warning'
		});
		rejectBtn.addEventListener('click', () => this.handleReject());
		
		// Create diff container
		const diffContainer = mainContainer.createDiv({ cls: 'diff-container' });
		
		// Get the old file contents
		let oldContents = '';
		
		// Check if old and new paths are the same (editing existing file)
		// or if they're different (new file or rename)
		if (this.state.oldFilePath === this.state.newFilePath) {
			// Editing existing file - try to read current contents
			const oldFile = this.app.vault.getAbstractFileByPath(this.state.oldFilePath);
			if (oldFile && oldFile instanceof TFile) {
				try {
					oldContents = await this.app.vault.read(oldFile);
				} catch (error) {
					console.error('Failed to read old file:', error);
					// File might not exist yet, which is fine for new files
				}
			}
		} else if (this.state.oldFilePath) {
			// Different paths - could be a rename or comparing to a different file
			const oldFile = this.app.vault.getAbstractFileByPath(this.state.oldFilePath);
			if (oldFile && oldFile instanceof TFile) {
				try {
					oldContents = await this.app.vault.read(oldFile);
				} catch (error) {
					console.error('Failed to read old file:', error);
				}
			}
		}
		// If oldContents is still empty, it means we're creating a new file
		
		// Create the diff display
		this.renderDiff(diffContainer, oldContents, this.state.newFileContents || '');
	}

	private renderDiff(container: HTMLElement, oldText: string, newText: string) {
		// Use the diff library to compute differences
		const differences = diffLines(oldText, newText);
		
		// Create two-column layout
		const wrapper = container.createDiv({ cls: 'diff-wrapper' });
		const leftColumn = wrapper.createDiv({ cls: 'diff-column diff-column-old' });
		const rightColumn = wrapper.createDiv({ cls: 'diff-column diff-column-new' });
		
		// Add column headers
		leftColumn.createDiv({ cls: 'diff-column-header', text: 'Original' });
		rightColumn.createDiv({ cls: 'diff-column-header', text: 'Modified' });
		
		// Create content areas
		const leftContent = leftColumn.createDiv({ cls: 'diff-content' });
		const rightContent = rightColumn.createDiv({ cls: 'diff-content' });
		
		let leftLineNum = 1;
		let rightLineNum = 1;
		
		differences.forEach((part: Change) => {
			const lines = part.value.split('\n').filter((_, i, arr) => 
				i < arr.length - 1 || part.value[part.value.length - 1] !== '\n'
			);
			
			if (part.added) {
				// Added lines - show only in right column
				lines.forEach(line => {
					this.createLineElement(rightContent, line, 'added', rightLineNum++);
				});
				// Add placeholder in left column
				lines.forEach(() => {
					this.createLineElement(leftContent, '', 'placeholder', null);
				});
			} else if (part.removed) {
				// Removed lines - show only in left column
				lines.forEach(line => {
					this.createLineElement(leftContent, line, 'removed', leftLineNum++);
				});
				// Add placeholder in right column
				lines.forEach(() => {
					this.createLineElement(rightContent, '', 'placeholder', null);
				});
			} else {
				// Unchanged lines - show in both columns
				lines.forEach(line => {
					this.createLineElement(leftContent, line, 'unchanged', leftLineNum++);
					this.createLineElement(rightContent, line, 'unchanged', rightLineNum++);
				});
			}
		});
	}

	private createLineElement(
		container: HTMLElement, 
		text: string, 
		type: 'added' | 'removed' | 'unchanged' | 'placeholder',
		lineNum: number | null
	) {
		const lineEl = container.createDiv({ cls: `diff-line diff-line-${type}` });
		
		// Line number
		if (lineNum !== null) {
			lineEl.createSpan({ 
				cls: 'diff-line-number', 
				text: lineNum.toString() 
			});
		} else {
			lineEl.createSpan({ cls: 'diff-line-number' });
		}
		
		// Line content
		lineEl.createSpan({ 
			cls: 'diff-line-content', 
			text: text || '\u00A0' // Non-breaking space for empty lines
		});
	}

	private async handleSave() {
		try {
			// Handle file deletion
			if (!this.state.newFileContents || this.state.newFileContents.length === 0) {
				const fileToDelete = this.app.vault.getAbstractFileByPath(this.state.oldFilePath);
				if (fileToDelete && fileToDelete instanceof TFile) {
					await this.app.vault.delete(fileToDelete);
					new Notice(`File deleted: ${this.state.oldFilePath}`);
				} else {
					throw new Error(`File not found: ${this.state.oldFilePath}`);
				}
			}
			// Handle rename/move
			else if (this.state.oldFilePath !== this.state.newFilePath) {
				const oldFile = this.app.vault.getAbstractFileByPath(this.state.oldFilePath);
				
				if (oldFile && oldFile instanceof TFile) {
					// First, ensure the target directory exists
					const dir = this.state.newFilePath.substring(0, this.state.newFilePath.lastIndexOf('/'));
					if (dir) {
						await this.app.vault.createFolder(dir).catch(() => {
							// Folder might already exist
						});
					}
					
					// Rename/move the file
					await this.app.vault.rename(oldFile, this.state.newFilePath);
					
					// Update contents if changed
					const newFile = this.app.vault.getAbstractFileByPath(this.state.newFilePath);
					if (newFile && newFile instanceof TFile) {
						await this.app.vault.modify(newFile, this.state.newFileContents);
					}
					
					new Notice(`File moved: ${this.state.oldFilePath} → ${this.state.newFilePath}`);
				} else {
					// Old file doesn't exist, so just create new one
					const dir = this.state.newFilePath.substring(0, this.state.newFilePath.lastIndexOf('/'));
					if (dir) {
						await this.app.vault.createFolder(dir).catch(() => {});
					}
					await this.app.vault.create(this.state.newFilePath, this.state.newFileContents);
					new Notice(`File created: ${this.state.newFilePath}`);
				}
			}
			// Handle create or modify
			else {
				let file = this.app.vault.getAbstractFileByPath(this.state.newFilePath);
				
				if (!file) {
					// Create parent directories if needed
					const dir = this.state.newFilePath.substring(0, this.state.newFilePath.lastIndexOf('/'));
					if (dir) {
						await this.app.vault.createFolder(dir).catch(() => {
							// Folder might already exist
						});
					}
					
					// Create the file
					file = await this.app.vault.create(this.state.newFilePath, this.state.newFileContents);
					new Notice(`File created: ${this.state.newFilePath}`);
				} else if (file instanceof TFile) {
					// Modify existing file
					await this.app.vault.modify(file, this.state.newFileContents);
					new Notice(`File saved: ${this.state.newFilePath}`);
				} else {
					throw new Error('Target path is a folder, not a file');
				}
			}
			
			// Resolve the promise with success
			if (this.resolvePromise) {
				this.resolvePromise('FILE_SAVED');
			}
			
			// Replace diff view with the saved file in the same tab
			const finalFile = this.app.vault.getAbstractFileByPath(this.state.newFilePath);
			if (finalFile && finalFile instanceof TFile) {
				await this.leaf.openFile(finalFile);
			} else {
				// File doesn't exist (shouldn't happen after save), close
				this.close();
			}
		} catch (error) {
			console.error('Failed to save changes:', error);
			new Notice(`Failed to save changes: ${error.message}`);
		}
	}

	private handleReject() {
		new Notice('Changes rejected');
		
		// Resolve the promise with rejection
		if (this.resolvePromise) {
			this.resolvePromise('DIFF_REJECTED');
		}
		
		// Close the view
		this.close();
	}

	async onClose() {
		// If the view is closed without a decision, treat it as rejection
		if (this.resolvePromise) {
			this.resolvePromise('DIFF_REJECTED');
			this.resolvePromise = null;
		}
	}

	private close() {
		this.app.workspace.detachLeavesOfType(DIFF_VIEW_TYPE);
	}

	// Method to get the user decision promise
	getUserDecision(): Promise<'FILE_SAVED' | 'DIFF_REJECTED'> {
		return this.userDecisionPromise;
	}
}

// CSS styles for the diff view
export const DIFF_VIEW_STYLES = `
.claude-diff-view {
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.diff-header {
	padding: 10px 20px;
	border-bottom: 1px solid var(--background-modifier-border);
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-shrink: 0;
}

.diff-header h3 {
	margin: 0;
	font-size: 1.2em;
}

.diff-buttons {
	display: flex;
	gap: 10px;
}

.diff-buttons button {
	padding: 5px 15px;
}

.diff-container {
	flex: 1;
	overflow: auto;
	padding: 10px;
}

.diff-wrapper {
	display: flex;
	gap: 10px;
	min-width: fit-content;
}

.diff-column {
	flex: 1;
	min-width: 0;
	border: 1px solid var(--background-modifier-border);
	border-radius: 4px;
	overflow: hidden;
}

.diff-column-header {
	padding: 5px 10px;
	background-color: var(--background-secondary);
	font-weight: bold;
	text-align: center;
	border-bottom: 1px solid var(--background-modifier-border);
}

.diff-content {
	font-family: var(--font-monospace);
	font-size: 0.9em;
	line-height: 1.4;
}

.diff-line {
	display: flex;
	min-height: 1.4em;
}

.diff-line-number {
	width: 50px;
	padding: 0 10px;
	text-align: right;
	color: var(--text-muted);
	background-color: var(--background-secondary);
	border-right: 1px solid var(--background-modifier-border);
	user-select: none;
	flex-shrink: 0;
}

.diff-line-content {
	flex: 1;
	padding: 0 10px;
	white-space: pre;
	overflow-x: auto;
}

.diff-line-added {
	background-color: rgba(0, 255, 0, 0.1);
}

.diff-line-removed {
	background-color: rgba(255, 0, 0, 0.1);
}

.diff-line-placeholder {
	background-color: var(--background-secondary-alt);
}

.diff-line-placeholder .diff-line-number {
	background-color: transparent;
}
`;