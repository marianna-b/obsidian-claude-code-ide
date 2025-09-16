/**
 * Response helper utilities for consistent MCP tool response formatting
 */

export interface ToolResponse<T = any> {
	content: Array<{
		type: "text";
		text: string;
	}>;
}

export interface ErrorResponse {
	code: number;
	message: string;
}

/**
 * Format a tool response according to MCP protocol
 * @param data The response data - will be JSON stringified if not a string
 */
export function formatToolResponse(data: any): ToolResponse {
	return {
		content: [{
			type: "text",
			text: typeof data === "string" ? data : JSON.stringify(data)
		}]
	};
}

/**
 * Format an error response according to MCP protocol
 * @param code Error code (usually -32603 for internal errors)
 * @param message Error message
 */
export function formatErrorResponse(code: number, message: string): ErrorResponse {
	return {
		code,
		message
	};
}

/**
 * Standard MCP error codes
 */
export const ErrorCodes = {
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
	METHOD_NOT_FOUND: -32601,
} as const;