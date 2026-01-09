/**
 * Tests for chunk computation logic
 */

import { computeDiffChunks, applyChunks } from './diff-chunks';

describe('diff-chunks', () => {
	describe('computeDiffChunks', () => {
		it('should compute a single change chunk', () => {
			const oldContent = 'Hello world';
			const newContent = 'Hello universe';
			
			const chunks = computeDiffChunks(oldContent, newContent);
			
			expect(chunks.length).toBe(1);
			expect(chunks[0].type).toBe('change');
			expect(chunks[0].status).toBe('pending');
			expect(chunks[0].oldText).toBe('world');
			expect(chunks[0].newText).toBe('universe');
		});
		
		it('should compute an insert chunk', () => {
			const oldContent = 'Hello';
			const newContent = 'Hello world';
			
			const chunks = computeDiffChunks(oldContent, newContent);
			
			expect(chunks.length).toBe(1);
			expect(chunks[0].type).toBe('insert');
			expect(chunks[0].newText).toBe(' world');
		});
		
		it('should compute a delete chunk', () => {
			const oldContent = 'Hello world';
			const newContent = 'Hello';
			
			const chunks = computeDiffChunks(oldContent, newContent);
			
			expect(chunks.length).toBe(1);
			expect(chunks[0].type).toBe('delete');
			expect(chunks[0].oldText).toBe(' world');
		});
		
		it('should separate chunks with large gaps', () => {
			const oldContent = 'Hello world. This is a test. Goodbye world.';
			const newContent = 'Hello universe. This is a test. Goodbye universe.';
			
			const chunks = computeDiffChunks(oldContent, newContent, 10);
			
			expect(chunks.length).toBe(2);
			expect(chunks[0].oldText).toContain('world');
			expect(chunks[0].newText).toContain('universe');
			expect(chunks[1].oldText).toContain('world');
			expect(chunks[1].newText).toContain('universe');
		});
		
		it('should group nearby changes into one chunk', () => {
			const oldContent = 'Hello world test';
			const newContent = 'Hi universe exam';
			
			const chunks = computeDiffChunks(oldContent, newContent, 50);
			
			// All changes are close together, should be one chunk
			expect(chunks.length).toBe(1);
		});
	});
	
	describe('applyChunks', () => {
		it('should apply accepted chunks', () => {
			const oldContent = 'Hello world';
			const chunks = computeDiffChunks(oldContent, 'Hello universe');
			
			const result = applyChunks(oldContent, chunks, [
				{ chunkId: chunks[0].id, accepted: true }
			]);
			
			expect(result).toBe('Hello universe');
		});
		
		it('should not apply rejected chunks', () => {
			const oldContent = 'Hello world';
			const chunks = computeDiffChunks(oldContent, 'Hello universe');
			
			const result = applyChunks(oldContent, chunks, [
				{ chunkId: chunks[0].id, accepted: false }
			]);
			
			expect(result).toBe('Hello world');
		});
		
		it('should apply multiple chunks correctly', () => {
			const oldContent = 'Hello world. Goodbye world.';
			const newContent = 'Hello universe. Goodbye universe.';
			const chunks = computeDiffChunks(oldContent, newContent, 5);
			
			// Accept all chunks
			const decisions = chunks.map(c => ({ chunkId: c.id, accepted: true }));
			const result = applyChunks(oldContent, chunks, decisions);
			
			expect(result).toBe(newContent);
		});
		
		it('should handle mixed accept/reject', () => {
			const oldContent = 'A B C';
			const newContent = 'A X Y';
			const chunks = computeDiffChunks(oldContent, newContent);
			
			// Only accept first part of change
			const result = applyChunks(oldContent, chunks, [
				{ chunkId: chunks[0].id, accepted: true }
			]);
			
			expect(result).toBe('A X Y');
		});
	});
});
