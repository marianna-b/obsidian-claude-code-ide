/**
 * Chunk computation logic for inline diffs
 */

import DiffMatchPatch = require('diff-match-patch');
import { DiffChunk, ChunkDecision } from './types';

/**
 * Compute diff chunks from old and new content
 */
export function computeDiffChunks(
	oldContent: string,
	newContent: string,
	minGapSize: number = 50
): DiffChunk[] {
	const dmp = new DiffMatchPatch();
	
	// Compute the diff with semantic cleanup
	const diffs = dmp.diff_main(oldContent, newContent);
	dmp.diff_cleanupSemantic(diffs);
	
	// Group diffs into chunks
	return groupDiffsIntoChunks(diffs, minGapSize);
}

/**
 * Group consecutive diffs into logical chunks
 * Separate chunks if gap between changes exceeds threshold
 */
function groupDiffsIntoChunks(
	diffs: Array<[number, string]>,
	minGapSize: number
): DiffChunk[] {
	const chunks: DiffChunk[] = [];
	let currentChunk: Partial<DiffChunk> | null = null;
	let oldPos = 0;
	let newPos = 0;
	let unchangedCount = 0;
	
	for (const [op, text] of diffs) {
		const textLength = text.length;
		
		if (op === DiffMatchPatch.DIFF_EQUAL) {
			// Unchanged text
			unchangedCount += textLength;
			
			// If gap is large enough and we have a current chunk, finalize it
			if (currentChunk && unchangedCount >= minGapSize) {
				finalizeChunk(currentChunk, chunks);
				currentChunk = null;
				unchangedCount = 0;
			}
			
			oldPos += textLength;
			newPos += textLength;
		} else {
			// Start a new chunk if needed
			if (!currentChunk) {
				currentChunk = {
					id: generateChunkId(),
					oldRange: { from: oldPos, to: oldPos },
					newRange: { from: newPos, to: newPos },
					oldText: '',
					newText: '',
					status: 'pending' as const
				};
			}
			
			unchangedCount = 0;
			
			if (op === DiffMatchPatch.DIFF_DELETE) {
				// Text removed from old
				currentChunk.oldText = (currentChunk.oldText || '') + text;
				currentChunk.oldRange!.to = oldPos + textLength;
				oldPos += textLength;
			} else if (op === DiffMatchPatch.DIFF_INSERT) {
				// Text added to new
				currentChunk.newText = (currentChunk.newText || '') + text;
				currentChunk.newRange!.to = newPos + textLength;
				newPos += textLength;
			}
		}
	}
	
	// Finalize any remaining chunk
	if (currentChunk) {
		finalizeChunk(currentChunk, chunks);
	}
	
	return chunks;
}

/**
 * Finalize a chunk and add it to the chunks array
 */
function finalizeChunk(chunk: Partial<DiffChunk>, chunks: DiffChunk[]): void {
	// Determine chunk type
	let type: 'change' | 'insert' | 'delete';
	if (chunk.oldText && chunk.newText) {
		type = 'change';
	} else if (chunk.newText) {
		type = 'insert';
	} else {
		type = 'delete';
	}
	
	chunks.push({
		id: chunk.id!,
		type,
		oldRange: chunk.oldRange!,
		newRange: chunk.newRange!,
		oldText: chunk.oldText || '',
		newText: chunk.newText || '',
		status: chunk.status!
	});
}

/**
 * Generate a unique chunk ID
 */
function generateChunkId(): string {
	return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Apply accepted chunks to the original content
 */
export function applyChunks(
	originalContent: string,
	chunks: DiffChunk[],
	decisions: ChunkDecision[]
): string {
	// Create a map of accepted chunk IDs
	const acceptedIds = new Set(
		decisions.filter(d => d.accepted).map(d => d.chunkId)
	);
	
	// Sort chunks by their position in the original content (reverse order for proper indexing)
	const sortedChunks = [...chunks]
		.filter(chunk => acceptedIds.has(chunk.id))
		.sort((a, b) => b.oldRange.from - a.oldRange.from);
	
	let result = originalContent;
	
	// Apply changes in reverse order to maintain correct indices
	for (const chunk of sortedChunks) {
		const before = result.substring(0, chunk.oldRange.from);
		const after = result.substring(chunk.oldRange.to);
		result = before + chunk.newText + after;
	}
	
	return result;
}
