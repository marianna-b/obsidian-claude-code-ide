import { formatToolResponse, formatErrorResponse, ErrorCodes, ToolResponse, ErrorResponse } from "./response-helpers";

describe("Response Helpers", () => {
	describe("formatToolResponse", () => {
		// Happy path tests
		it("should format a string response correctly", () => {
			const result = formatToolResponse("Hello world");
			expect(result).toEqual({
				content: [{
					type: "text",
					text: "Hello world"
				}]
			});
		});

		it("should JSON stringify object responses", () => {
			const data = { foo: "bar", count: 42 };
			const result = formatToolResponse(data);
			expect(result).toEqual({
				content: [{
					type: "text",
					text: JSON.stringify(data)
				}]
			});
		});

		it("should JSON stringify array responses", () => {
			const data = ["item1", "item2", "item3"];
			const result = formatToolResponse(data);
			expect(result).toEqual({
				content: [{
					type: "text",
					text: JSON.stringify(data)
				}]
			});
		});

		// Edge cases
		it("should handle null values", () => {
			const result = formatToolResponse(null);
			expect(result).toEqual({
				content: [{
					type: "text",
					text: "null"
				}]
			});
		});

	it("should handle undefined values", () => {
		const result = formatToolResponse(undefined);
		expect(result).toEqual({
			content: [{
				type: "text",
				text: "undefined"
			}]
		});
	});

		it("should handle boolean values", () => {
			const resultTrue = formatToolResponse(true);
			expect(resultTrue).toEqual({
				content: [{
					type: "text",
					text: "true"
				}]
			});

			const resultFalse = formatToolResponse(false);
			expect(resultFalse).toEqual({
				content: [{
					type: "text",
					text: "false"
				}]
			});
		});

		it("should handle numbers", () => {
			const result = formatToolResponse(42);
			expect(result).toEqual({
				content: [{
					type: "text",
					text: "42"
				}]
			});
			
			// Test edge cases for numbers
			const zero = formatToolResponse(0);
			expect(zero.content[0].text).toBe("0");
			
			const negative = formatToolResponse(-42);
			expect(negative.content[0].text).toBe("-42");
			
			const float = formatToolResponse(3.14159);
			expect(float.content[0].text).toBe("3.14159");
		});

		it("should handle empty strings", () => {
			const result = formatToolResponse("");
			expect(result).toEqual({
				content: [{
					type: "text",
					text: ""
				}]
			});
		});

		it("should handle complex nested objects", () => {
			const data = {
				level1: {
					level2: {
						value: "deep",
						array: [1, 2, 3],
						nested: {
							boolean: true,
							null: null
						}
					}
				}
			};
			const result = formatToolResponse(data);
			expect(result).toEqual({
				content: [{
					type: "text",
					text: JSON.stringify(data)
				}]
			});
			
			// Verify it's valid JSON
			const parsed = JSON.parse(result.content[0].text);
			expect(parsed).toEqual(data);
		});

		// Special cases
		it("should handle strings with special characters", () => {
			const specialString = "Hello\nWorld\t\"Quotes\"\\'Apostrophe'\\\\Backslash";
			const result = formatToolResponse(specialString);
			expect(result.content[0].text).toBe(specialString);
		});

		it("should handle circular references gracefully", () => {
			const circular: any = { a: 1 };
			circular.self = circular;
			
			// JSON.stringify throws on circular references
			expect(() => formatToolResponse(circular)).toThrow();
		});
	});

	describe("formatErrorResponse", () => {
		// Happy path
		it("should format error responses with code and message", () => {
			const result = formatErrorResponse(ErrorCodes.INVALID_PARAMS, "Missing required parameter");
			expect(result).toEqual({
				code: ErrorCodes.INVALID_PARAMS,
				message: "Missing required parameter"
			});
		});

		it("should use correct error codes", () => {
			const internalError = formatErrorResponse(ErrorCodes.INTERNAL_ERROR, "Something went wrong");
			expect(internalError.code).toBe(-32603);
			expect(internalError.message).toBe("Something went wrong");

			const invalidParams = formatErrorResponse(ErrorCodes.INVALID_PARAMS, "Bad params");
			expect(invalidParams.code).toBe(-32602);
			expect(invalidParams.message).toBe("Bad params");

			const methodNotFound = formatErrorResponse(ErrorCodes.METHOD_NOT_FOUND, "Unknown method");
			expect(methodNotFound.code).toBe(-32601);
			expect(methodNotFound.message).toBe("Unknown method");
		});

		// Edge cases
		it("should handle empty error messages", () => {
			const result = formatErrorResponse(ErrorCodes.INTERNAL_ERROR, "");
			expect(result).toEqual({
				code: ErrorCodes.INTERNAL_ERROR,
				message: ""
			});
		});

		it("should handle very long error messages", () => {
			const longMessage = "A".repeat(1000);
			const result = formatErrorResponse(ErrorCodes.INTERNAL_ERROR, longMessage);
			expect(result.message).toBe(longMessage);
			expect(result.message.length).toBe(1000);
		});

		it("should handle error messages with special characters", () => {
			const specialMessage = "Error: \"Failed\" \n\t with 'special' \\characters\\";
			const result = formatErrorResponse(ErrorCodes.INTERNAL_ERROR, specialMessage);
			expect(result.message).toBe(specialMessage);
		});
	});

	describe("ErrorCodes", () => {
		it("should have correct JSON-RPC error codes", () => {
			expect(ErrorCodes.INVALID_PARAMS).toBe(-32602);
			expect(ErrorCodes.INTERNAL_ERROR).toBe(-32603);
			expect(ErrorCodes.METHOD_NOT_FOUND).toBe(-32601);
		});

		it("should be readonly", () => {
			// TypeScript will ensure this at compile time, but we can verify the values don't change
			const codes = { ...ErrorCodes };
			expect(ErrorCodes.INVALID_PARAMS).toBe(codes.INVALID_PARAMS);
			expect(ErrorCodes.INTERNAL_ERROR).toBe(codes.INTERNAL_ERROR);
			expect(ErrorCodes.METHOD_NOT_FOUND).toBe(codes.METHOD_NOT_FOUND);
		});

		it("should export the correct type", () => {
			// Type checking - these should be numbers
			expect(typeof ErrorCodes.INVALID_PARAMS).toBe("number");
			expect(typeof ErrorCodes.INTERNAL_ERROR).toBe("number");
			expect(typeof ErrorCodes.METHOD_NOT_FOUND).toBe("number");
		});
	});

	describe("Type Safety", () => {
		it("should return correct ToolResponse type", () => {
			const response: ToolResponse = formatToolResponse("test");
			expect(response).toBeDefined();
			expect(response.content).toBeInstanceOf(Array);
			expect(response.content.length).toBe(1);
			expect(response.content[0].type).toBe("text");
		});

		it("should return correct ErrorResponse type", () => {
			const response: ErrorResponse = formatErrorResponse(ErrorCodes.INTERNAL_ERROR, "test error");
			expect(response).toBeDefined();
			expect(typeof response.code).toBe("number");
			expect(typeof response.message).toBe("string");
		});
	});
});

// Integration tests
describe("Response Format Protocol Compliance", () => {
	it("should ensure all tool responses have parseable JSON in text field for non-string types", () => {
		const testCases = [
			{ input: { success: true, data: "test" }, shouldParse: true },
			{ input: ["file1.txt", "file2.txt"], shouldParse: true },
			{ input: { diagnostics: [], systemInfo: { vault: "test" } }, shouldParse: true },
			{ input: null, shouldParse: true },
			{ input: 42, shouldParse: true },
			{ input: true, shouldParse: true },
			{ input: "plain string", shouldParse: false } // Strings should not be JSON parsed
		];

		testCases.forEach(({ input, shouldParse }) => {
			const response = formatToolResponse(input);
			const textContent = response.content[0].text;
			
			if (shouldParse) {
				// Should be valid JSON
				expect(() => JSON.parse(textContent)).not.toThrow();
				expect(JSON.parse(textContent)).toEqual(input);
			} else {
				// Plain strings should be returned as-is
				expect(textContent).toBe(input);
			}
		});
	});

	it("should ensure consistent structure for all responses", () => {
		const responses = [
			formatToolResponse("string"),
			formatToolResponse(123),
			formatToolResponse({ key: "value" }),
			formatToolResponse([1, 2, 3]),
			formatToolResponse(null)
		];

		responses.forEach(response => {
			// Check structure
			expect(response).toHaveProperty("content");
			expect(Array.isArray(response.content)).toBe(true);
			expect(response.content.length).toBe(1);
			expect(response.content[0]).toHaveProperty("type", "text");
			expect(response.content[0]).toHaveProperty("text");
			expect(typeof response.content[0].text).toBe("string");
		});
	});

	it("should handle real-world tool response examples", () => {
		// Example: getCurrentSelection response
		const selectionData = {
			success: true,
			text: "selected code",
			filePath: "src/example.ts",
			selection: {
				start: { line: 10, character: 5 },
				end: { line: 15, character: 20 }
			}
		};
		
		const selectionResponse = formatToolResponse(selectionData);
		const parsedSelection = JSON.parse(selectionResponse.content[0].text);
		expect(parsedSelection).toEqual(selectionData);

		// Example: getWorkspaceFolders response
		const workspaceData = {
			success: true,
			folders: [{
				name: "My Vault",
				uri: "file:///Users/test/vault",
				path: "/Users/test/vault"
			}],
			rootPath: "/Users/test/vault"
		};
		
		const workspaceResponse = formatToolResponse(workspaceData);
		const parsedWorkspace = JSON.parse(workspaceResponse.content[0].text);
		expect(parsedWorkspace).toEqual(workspaceData);

		// Example: getDiagnostics (empty array for Obsidian)
		const diagnosticsResponse = formatToolResponse([]);
		expect(diagnosticsResponse.content[0].text).toBe("[]");
	});
});