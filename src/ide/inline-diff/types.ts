/**
 * Types for the inline diff system
 */

/**
 * Represents a single chunk of changes in the diff
 */
export interface DiffChunk {
	/** Unique identifier for this chunk */
	id: string;
	
	/** Type of change */
	type: 'change' | 'insert' | 'delete';
	
	/** Range in the original content */
	oldRange: { from: number; to: number };
	
	/** Range in the new content */
	newRange: { from: number; to: number };
	
	/** Original text */
	oldText: string;
	
	/** New text */
	newText: string;
	
	/** Current status of this chunk */
	status: 'pending' | 'accepted' | 'rejected';
}

/**
 * State for the inline diff system
 */
export interface InlineDiffState {
	/** Path to the file being diffed */
	filePath: string;
	
	/** All diff chunks */
	chunks: DiffChunk[];
	
	/** Original file content */
	originalContent: string;
	
	/** Target content (what we're diffing to) */
	targetContent: string;
}

/**
 * User's decision about a chunk
 */
export interface ChunkDecision {
	/** ID of the chunk */
	chunkId: string;
	
	/** Whether the chunk was accepted */
	accepted: boolean;
}
