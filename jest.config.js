/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	testMatch: ['**/*.test.ts', '**/*.spec.ts'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/**/*.test.ts',
		'!src/**/*.spec.ts',
	],
	globals: {
		'ts-jest': {
			tsconfig: './tsconfig.test.json',
		},
	},
	moduleNameMapper: {
		// Mock Obsidian module since it won't be available in tests
		'^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts',
	},
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
};