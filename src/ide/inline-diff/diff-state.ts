/**
 * State management for inline diff system using CodeMirror StateFields and StateEffects
 */

import { StateEffect, StateField } from '@codemirror/state';
import { InlineDiffState, DiffChunk } from './types';

/**
 * Effect to show inline diff
 */
export const showInlineDiffEffect = StateEffect.define<InlineDiffState>();

/**
 * Effect to accept a chunk
 */
export const acceptChunkEffect = StateEffect.define<string>();

/**
 * Effect to reject a chunk
 */
export const rejectChunkEffect = StateEffect.define<string>();

/**
 * Effect to accept all chunks
 */
export const acceptAllChunksEffect = StateEffect.define<null>();

/**
 * Effect to reject all chunks
 */
export const rejectAllChunksEffect = StateEffect.define<null>();

/**
 * Effect to clear inline diff
 */
export const clearInlineDiffEffect = StateEffect.define<null>();

/**
 * StateField to store the current inline diff state
 */
export const inlineDiffStateField = StateField.define<InlineDiffState | null>({
	create() {
		return null;
	},
	
	update(state, tr) {
		// Check for showInlineDiffEffect
		for (const effect of tr.effects) {
			if (effect.is(showInlineDiffEffect)) {
				return effect.value;
			}
		}
		
		// Check for clearInlineDiffEffect
		for (const effect of tr.effects) {
			if (effect.is(clearInlineDiffEffect)) {
				return null;
			}
		}
		
		// If no state, return null
		if (!state) {
			return null;
		}
		
		// Handle chunk acceptance/rejection
		let newState = state;
		
		for (const effect of tr.effects) {
			if (effect.is(acceptChunkEffect)) {
				newState = updateChunkStatus(newState, effect.value, 'accepted');
			} else if (effect.is(rejectChunkEffect)) {
				newState = updateChunkStatus(newState, effect.value, 'rejected');
			} else if (effect.is(acceptAllChunksEffect)) {
				newState = {
					...newState,
					chunks: newState.chunks.map(chunk => 
						chunk.status === 'pending' 
							? { ...chunk, status: 'accepted' as const }
							: chunk
					)
				};
			} else if (effect.is(rejectAllChunksEffect)) {
				newState = {
					...newState,
					chunks: newState.chunks.map(chunk => 
						chunk.status === 'pending'
							? { ...chunk, status: 'rejected' as const }
							: chunk
					)
				};
			}
		}
		
		return newState;
	}
});

/**
 * Update the status of a specific chunk
 */
function updateChunkStatus(
	state: InlineDiffState,
	chunkId: string,
	status: 'accepted' | 'rejected'
): InlineDiffState {
	return {
		...state,
		chunks: state.chunks.map(chunk =>
			chunk.id === chunkId
				? { ...chunk, status }
				: chunk
		)
	};
}

/**
 * Helper to get pending chunks count
 */
export function getPendingChunksCount(state: InlineDiffState | null): number {
	if (!state) return 0;
	return state.chunks.filter(c => c.status === 'pending').length;
}

/**
 * Helper to check if all chunks are processed
 */
export function areAllChunksProcessed(state: InlineDiffState | null): boolean {
	if (!state) return false;
	return state.chunks.every(c => c.status !== 'pending');
}

/**
 * Helper to get accepted chunks
 */
export function getAcceptedChunks(state: InlineDiffState | null): DiffChunk[] {
	if (!state) return [];
	return state.chunks.filter(c => c.status === 'accepted');
}
