/**
 * Main CodeMirror extension for inline diff functionality
 */

import { EditorState, RangeSetBuilder, StateField } from '@codemirror/state';
import { 
	Decoration, 
	DecorationSet, 
	EditorView, 
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { App, Notice, TFile } from 'obsidian';

import {
	inlineDiffStateField,
	getPendingChunksCount,
	areAllChunksProcessed,
	getAcceptedChunks,
	showInlineDiffEffect,
	acceptChunkEffect,
	rejectChunkEffect,
	acceptAllChunksEffect,
	rejectAllChunksEffect,
	clearInlineDiffEffect
} from './diff-state';
import { ChangeContentWidget, ChunkControlWidget, DiffHeaderWidget } from './diff-widgets';
import { applyChunks } from './diff-chunks';
import { DiffChunk } from './types';

/**
 * Store EditorView reference for widgets to use
 */
let editorViewRef: EditorView | null = null;

const viewRefPlugin = ViewPlugin.fromClass(class {
	constructor(view: EditorView) {
		editorViewRef = view;
	}
	
	destroy() {
		editorViewRef = null;
	}
});

/**
 * Generate decorations for the current diff state
 */
function generateDecorations(state: EditorState, view: EditorView): DecorationSet {
	const diffState = state.field(inlineDiffStateField, false);
	console.log('[InlineDiff] generateDecorations called, diffState:', diffState);
	if (!diffState) {
		return Decoration.none;
	}
	
	const builder = new RangeSetBuilder<Decoration>();
	const pendingCount = getPendingChunksCount(diffState);
	console.log('[InlineDiff] Pending chunks:', pendingCount, 'Total chunks:', diffState.chunks.length);
	
	// Add header widget at the top
	console.log('[InlineDiff] Adding header widget');
	builder.add(0, 0, Decoration.widget({
		widget: new DiffHeaderWidget(pendingCount, diffState.chunks.length, view),
		side: -1,
		block: true
	}));
	
	// Process only pending chunks
	const pendingChunks = diffState.chunks.filter(c => c.status === 'pending');
	
	console.log('[InlineDiff] Processing pending chunks:', pendingChunks.length);
	pendingChunks.forEach((chunk, index) => {
		console.log('[InlineDiff] Adding widget for chunk', index, 'at position', chunk.oldRange.from);
		// Add chunk control widget at the start of the chunk
		builder.add(chunk.oldRange.from, chunk.oldRange.from, Decoration.widget({
			widget: new ChunkControlWidget(chunk.id, index, pendingCount, view),
			side: -1,
			block: true
		}));
		
		// Add inline diff decorations
		addChunkDecorations(builder, chunk);
	});
	
	const result = builder.finish();
	console.log('[InlineDiff] Built decorations, size:', result.size);
	
	// Log what's in the decoration set
	const decorArray: any[] = [];
	result.between(0, state.doc.length, (from, to, value) => {
		decorArray.push({ from, to, spec: value.spec });
	});
	console.log('[InlineDiff] Decorations content:', decorArray);
	
	return result;
}

/**
 * Add decorations for a single chunk
 */
function addChunkDecorations(builder: RangeSetBuilder<Decoration>, chunk: DiffChunk): void {
	// For deletions and changes, mark the old text
	if (chunk.oldText) {
		// Add removed text widget
		builder.add(chunk.oldRange.from, chunk.oldRange.from, Decoration.widget({
			widget: new ChangeContentWidget(chunk.oldText, 'removed'),
			side: -1
		}));
		
		// Mark the range that will be replaced
		if (chunk.oldRange.from !== chunk.oldRange.to) {
			builder.add(chunk.oldRange.from, chunk.oldRange.to, Decoration.mark({
				class: 'cm-diff-replaced-text',
				attributes: { style: 'opacity: 0.3;' }
			}));
		}
	}
	
	// For insertions and changes, show the new text
	if (chunk.newText) {
		builder.add(chunk.oldRange.from, chunk.oldRange.from, Decoration.widget({
			widget: new ChangeContentWidget(chunk.newText, 'added'),
			side: 1
		}));
	}
}

/**
 * StateField for managing decorations
 */
const decorationStateField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		console.log('[InlineDiff] decorationStateField.create called');
		// We need access to EditorView for widgets, but it's not available during create
		// Decorations will be generated on first update
		return Decoration.none;
	},
	
	update(decorations: DecorationSet, tr): DecorationSet {
		console.log('[InlineDiff] decorationStateField.update called');
		
		// Check if diff state changed
		const diffState = tr.state.field(inlineDiffStateField, false);
		
		// If there's no diff state, clear decorations
		if (!diffState) {
			console.log('[InlineDiff] No diff state, clearing decorations');
			return Decoration.none;
		}
		
		// Regenerate decorations if diff state changed
		const hasStateChange = tr.effects.some(
			e => e.is(showInlineDiffEffect) || 
			     e.is(acceptChunkEffect) || 
			     e.is(rejectChunkEffect) || 
			     e.is(acceptAllChunksEffect) || 
			     e.is(rejectAllChunksEffect) || 
			     e.is(clearInlineDiffEffect)
		);
		
		if (hasStateChange && editorViewRef) {
			console.log('[InlineDiff] Diff state changed, regenerating decorations');
			return generateDecorations(tr.state, editorViewRef);
		}
		
		return decorations;
	},
	
	provide: (field) => EditorView.decorations.from(field)
});

/**
 * ViewPlugin to handle final application of changes
 */
function createApplyDiffPlugin(app: App) {
	return ViewPlugin.fromClass(class {
		constructor(private view: EditorView) {}
		
		update(update: ViewUpdate) {
			const diffState = update.state.field(inlineDiffStateField, false);
			if (!diffState) return;
			
			// Check if all chunks have been processed
			if (areAllChunksProcessed(diffState)) {
				// Apply accepted chunks
				this.applyAcceptedChanges(diffState);
			}
		}
		
		private async applyAcceptedChanges(diffState: any) {
			const acceptedChunks = getAcceptedChunks(diffState);
			
			if (acceptedChunks.length === 0) {
				// No chunks accepted
				new Notice('All changes discarded');
				this.clearDiff();
				return;
			}
			
			// Compute final content
			const decisions = acceptedChunks.map(c => ({ 
				chunkId: c.id, 
				accepted: true 
			}));
			const finalContent = applyChunks(
				diffState.originalContent,
				diffState.chunks,
				decisions
			);
			
			// Write to file
			try {
				const file = app.vault.getAbstractFileByPath(diffState.filePath);
				if (file && file instanceof TFile) {
					await app.vault.modify(file, finalContent);
					new Notice(`Applied ${acceptedChunks.length} ${acceptedChunks.length === 1 ? 'change' : 'changes'}`);
				} else {
					new Notice('Error: File not found', 5000);
				}
			} catch (error) {
				console.error('Failed to apply changes:', error);
				new Notice(`Failed to apply changes: ${error.message}`, 5000);
			}
			
			// Clear the diff state
			this.clearDiff();
		}
		
		private clearDiff() {
			this.view.dispatch({
				effects: clearInlineDiffEffect.of(null)
			});
		}
	});
}

/**
 * Focus guard plugin to prevent editor blur issues
 */
const focusGuardPlugin = ViewPlugin.fromClass(class {
	private onFocusOut: ((e: FocusEvent) => void) | null = null;
	private onBlur: ((e: FocusEvent) => void) | null = null;
	
	constructor(private view: EditorView) {
		const handler = (evt: FocusEvent) => {
			// Check if we have an active diff
			const diffState = this.view.state.field(inlineDiffStateField, false);
			if (diffState && getPendingChunksCount(diffState) > 0) {
				// Stop event propagation to prevent Obsidian from reacting
				evt.stopImmediatePropagation?.();
				evt.stopPropagation();
			}
		};
		
		this.onFocusOut = handler;
		this.onBlur = handler;
		
		this.view.dom.addEventListener('focusout', this.onFocusOut, true);
		this.view.dom.addEventListener('blur', this.onBlur, true);
		document.addEventListener('focusout', this.onFocusOut, true);
		document.addEventListener('blur', this.onBlur, true);
	}
	
	destroy() {
		if (this.onFocusOut) {
			this.view.dom.removeEventListener('focusout', this.onFocusOut, true);
			document.removeEventListener('focusout', this.onFocusOut, true);
		}
		if (this.onBlur) {
			this.view.dom.removeEventListener('blur', this.onBlur, true);
			document.removeEventListener('blur', this.onBlur, true);
		}
	}
});

/**
 * Create the inline diff extension
 */
export function createInlineDiffExtension(app: App) {
	return [
		inlineDiffStateField,
		viewRefPlugin, // Must come before decorationStateField
		decorationStateField,
		createApplyDiffPlugin(app),
		focusGuardPlugin
	];
}

// Export for use in IDE tools
export {
	showInlineDiffEffect,
	acceptChunkEffect,
	rejectChunkEffect,
	acceptAllChunksEffect,
	rejectAllChunksEffect,
	clearInlineDiffEffect,
	inlineDiffStateField
};
