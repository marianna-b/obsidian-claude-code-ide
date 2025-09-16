// Global test setup
// Add any global test configuration or mocks here

// Example: Set up global mocks if needed
global.console = {
	...console,
	// Suppress console.debug in tests unless explicitly testing it
	debug: jest.fn(),
};