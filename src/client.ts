/**
 * Thin wrapper around the MCP TypeScript SDK's streamable-http client.
 *
 * Owns a single Client + transport bound to the configured JetBrains URL.
 * Connection is lazy and resumable: connect on demand, close on shutdown,
 * and reconnect when the IDE restarts (new port) via the host extension.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpTool {
	name: string;
	description?: string;
	inputSchema?: unknown;
	annotations?: unknown;
}

export interface McpCallResult {
	content?: unknown[];
	isError?: boolean;
	structuredContent?: unknown;
	[key: string]: unknown;
}

export class JetBrainsMcpClient {
	private client: Client | null = null;
	private connected = false;
	private url: string;
	private headers: Record<string, string>;

	constructor(opts: { url: string; headers?: Record<string, string> }) {
		this.url = opts.url;
		this.headers = opts.headers ?? {};
	}

	updateConfig(opts: { url: string; headers?: Record<string, string> }): void {
		this.url = opts.url;
		this.headers = opts.headers ?? {};
	}

	getUrl(): string {
		return this.url;
	}

	isConnected(): boolean {
		return this.connected;
	}

	/** Open the streamable-http session. Safe to call repeatedly. */
	async connect(timeoutMs = 10_000): Promise<void> {
		if (this.connected && this.client) return;
		await this.closeInternal();

		let url: URL;
		try {
			url = new URL(this.url);
		} catch {
			throw new Error(`Invalid MCP url: ${this.url}`);
		}

		const transport = new StreamableHTTPClientTransport(url, {
			requestInit: { headers: this.headers },
		});
		const client = new Client(
			{ name: "pi-jetbrains-mcp", version: "0.1.0" },
			{ capabilities: {} },
		);

		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new Error(`Connection to ${this.url} timed out after ${timeoutMs}ms`)),
				timeoutMs,
			);
		});

		try {
			await Promise.race([client.connect(transport), timeout]);
			this.client = client;
			this.connected = true;
		} catch (err) {
			try {
				await client.close();
			} catch {
				// ignore
			}
			throw err;
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	async listTools(): Promise<McpTool[]> {
		if (!this.client) return [];
		const res = await this.client.listTools();
		return (res.tools ?? []) as McpTool[];
	}

	async callTool(
		name: string,
		args: Record<string, unknown> | undefined,
	): Promise<McpCallResult> {
		if (!this.client) throw new Error("MCP client not connected");
		const res = (await this.client.callTool({
			name,
			arguments: args ?? {},
		})) as McpCallResult;
		return res;
	}

	async close(): Promise<void> {
		await this.closeInternal();
	}

	private async closeInternal(): Promise<void> {
		if (this.client) {
			try {
				await this.client.close();
			} catch {
				// ignore
			}
		}
		this.client = null;
		this.connected = false;
	}
}
