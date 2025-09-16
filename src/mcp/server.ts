import { WebSocketServer, WebSocket } from "ws";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { McpRequest, McpNotification } from "./types";
import { getClaudeIdeDir } from "../claude-config";

export interface McpServerConfig {
	onMessage: (ws: WebSocket, request: McpRequest) => void;
	onConnection?: (ws: WebSocket) => void;
	onDisconnection?: (ws: WebSocket) => void;
}

export class McpServer {
	private wss!: WebSocketServer;
	private lockFilePath = "";
	private connectedClients: Set<WebSocket> = new Set();
	private config: McpServerConfig;
	private port: number = 0;
	private authToken: string = "";

	constructor(config: McpServerConfig) {
		this.config = config;
	}

	async start(): Promise<number> {
		// Generate auth token before starting server
		this.authToken = crypto.randomUUID();
		
		// 0 = choose a random free port
		this.wss = new WebSocketServer({ 
			port: 0,
			// Handle authentication during the upgrade handshake
			verifyClient: (info, cb) => {
				const authHeader = info.req.headers['x-claude-code-ide-authorization'] as string;
				
				if (!authHeader || authHeader !== this.authToken) {
					console.debug("[MCP] Rejecting connection - invalid auth token");
					// Reject with 401 Unauthorized
					cb(false, 401, 'Unauthorized');
					return;
				}
				
				console.debug("[MCP] Auth token valid, accepting connection");
				cb(true);
			}
		});

		// address() is cast-safe once server is listening
		this.port = (this.wss.address() as any).port as number;

		this.wss.on("connection", (sock: WebSocket) => {
			console.debug("[MCP] Client connected");
			this.connectedClients.add(sock);
			console.debug(`[MCP] Total connected clients: ${this.connectedClients.size}`);

			sock.on("message", (data) => {
				this.handleMessage(sock, data.toString());
			});

			sock.on("close", () => {
				console.debug("[MCP] Client disconnected");
				this.connectedClients.delete(sock);
				console.debug(`[MCP] Total connected clients: ${this.connectedClients.size}`);
				this.config.onDisconnection?.(sock);
			});

			sock.on("error", (error) => {
				console.debug("[MCP] Client error:", error);
				this.connectedClients.delete(sock);
			});

			this.config.onConnection?.(sock);
		});

		this.wss.on("error", (error) => {
			console.error("WebSocket server error:", error);
		});

		// Write the discovery lock-file Claude looks for
		await this.createLockFile(this.port);

		// Set environment variables that Claude Code CLI expects
		process.env.CLAUDE_CODE_SSE_PORT = this.port.toString();
		process.env.ENABLE_IDE_INTEGRATION = "true";

		return this.port;
	}

	stop(): void {
		this.wss?.close();
		if (this.lockFilePath && fs.existsSync(this.lockFilePath)) {
			fs.unlinkSync(this.lockFilePath);
		}
	}

	broadcast(message: McpNotification): void {
		const messageStr = JSON.stringify(message);
		console.debug("[MCP] Broadcasting message:", messageStr);
		for (const client of this.connectedClients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(messageStr);
			}
		}
	}

	get clientCount(): number {
		const count = this.connectedClients.size;
		console.debug(`[MCP] WebSocket server clientCount getter called: ${count}`);
		return count;
	}

	get serverPort(): number {
		return this.port;
	}

	private async createLockFile(port: number): Promise<void> {
		const ideDir = getClaudeIdeDir();
		fs.mkdirSync(ideDir, { recursive: true });

		this.lockFilePath = path.join(ideDir, `${port}.lock`);
		
		// We'll get the base path from the caller
		const lockFileContent = {
			pid: process.pid,
			workspaceFolders: [], // Will be populated by caller
			ideName: "Obsidian",
			transport: "ws",
			authToken: this.authToken, // Add auth token to lock file
		};
		fs.writeFileSync(this.lockFilePath, JSON.stringify(lockFileContent));
	}

	updateWorkspaceFolders(basePath: string): void {
		if (this.lockFilePath && fs.existsSync(this.lockFilePath)) {
			const lockContent = JSON.parse(fs.readFileSync(this.lockFilePath, 'utf8'));
			lockContent.workspaceFolders = [basePath];
			fs.writeFileSync(this.lockFilePath, JSON.stringify(lockContent));
		}
	}

	private handleMessage(sock: WebSocket, raw: string): void {
		console.debug("[MCP] Received message:", raw);
		let req: McpRequest;
		try {
			req = JSON.parse(raw);
		} catch {
			console.debug("[MCP] Invalid JSON received:", raw);
			return; // ignore invalid JSON
		}

		this.config.onMessage(sock, req);
	}
}