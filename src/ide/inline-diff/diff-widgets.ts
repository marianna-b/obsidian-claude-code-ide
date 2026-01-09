/**
 * Widget components for inline diff visualization
 */

import { EditorView, WidgetType } from '@codemirror/view';
import { 
	acceptChunkEffect, 
	rejectChunkEffect,
	acceptAllChunksEffect,
	rejectAllChunksEffect
} from './diff-state';

/**
 * Widget for inline change markers (added/removed text)
 */
export class ChangeContentWidget extends WidgetType {
	constructor(
		private readonly content: string,
		private readonly type: 'added' | 'removed' | 'accepted'
	) {
		super();
	}
	
	toDOM(): HTMLElement {
		// Use div for multi-line content, span for single-line
		const hasNewlines = this.content.includes('\n');
		const element = document.createElement(hasNewlines ? 'div' : 'span');
		element.className = `cm-change-widget cm-change-${this.type}`;
		element.textContent = this.content;
		
		// Prevent mouse interactions from affecting editor focus (except for accepted)
		if (this.type !== 'accepted') {
			element.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
			});
		}
		
		return element;
	}
	
	ignoreEvent(): boolean {
		return true;
	}
}

/**
 * Widget for chunk control buttons
 */
export class ChunkControlWidget extends WidgetType {
	constructor(
		private readonly chunkId: string,
		private readonly chunkIndex: number,
		private readonly totalChunks: number,
		private readonly view: EditorView
	) {
		super();
	}
	
	toDOM(): HTMLElement {
		console.log('[Widget] Creating ChunkControlWidget', this.chunkId, 'at index', this.chunkIndex);
		const container = document.createElement('div');
		container.className = 'cm-diff-chunk-controls';
		
		// Accept button
		const acceptBtn = document.createElement('button');
		acceptBtn.className = 'accept-button';
		acceptBtn.textContent = 'Accept';
		acceptBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		acceptBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.view.dispatch({
				effects: acceptChunkEffect.of(this.chunkId)
			});
		});
		
		// Discard button
		const discardBtn = document.createElement('button');
		discardBtn.textContent = 'Discard';
		discardBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		discardBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.view.dispatch({
				effects: rejectChunkEffect.of(this.chunkId)
			});
		});
		
		// Chunk info
		const info = document.createElement('span');
		info.className = 'cm-diff-chunk-info';
		info.textContent = `Chunk ${this.chunkIndex + 1} of ${this.totalChunks}`;
		
		container.appendChild(acceptBtn);
		container.appendChild(discardBtn);
		container.appendChild(info);
		
		return container;
	}
	
	ignoreEvent(): boolean {
		return true;
	}
}

/**
 * Widget for diff header showing progress and global controls
 */
export class DiffHeaderWidget extends WidgetType {
	constructor(
		private readonly pendingCount: number,
		private readonly totalCount: number,
		private readonly view: EditorView
	) {
		super();
	}
	
	toDOM(): HTMLElement {
		console.log('[Widget] Creating DiffHeaderWidget', this.pendingCount, 'pending');
		const header = document.createElement('div');
		header.className = 'cm-diff-header';
		
		// Counter section
		const counter = document.createElement('div');
		counter.className = 'cm-diff-header-counter';
		counter.textContent = `${this.pendingCount} ${this.pendingCount === 1 ? 'chunk' : 'chunks'} remaining`;
		
		// Actions section
		const actions = document.createElement('div');
		actions.className = 'cm-diff-header-actions';
		
		// Accept All button
		const acceptAllBtn = document.createElement('button');
		acceptAllBtn.textContent = 'Accept All';
		acceptAllBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		acceptAllBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.view.dispatch({
				effects: acceptAllChunksEffect.of(null)
			});
		});
		
		// Reject All button
		const rejectAllBtn = document.createElement('button');
		rejectAllBtn.textContent = 'Reject All';
		rejectAllBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		rejectAllBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.view.dispatch({
				effects: rejectAllChunksEffect.of(null)
			});
		});
		
		actions.appendChild(acceptAllBtn);
		actions.appendChild(rejectAllBtn);
		
		header.appendChild(counter);
		header.appendChild(actions);
		
		return header;
	}
	
	ignoreEvent(): boolean {
		return true;
	}
	
	eq(other: DiffHeaderWidget): boolean {
		return this.pendingCount === other.pendingCount 
			&& this.totalCount === other.totalCount;
	}
}
