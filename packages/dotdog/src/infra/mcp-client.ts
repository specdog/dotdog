// MCP Client Transport — connect to external MCP servers over HTTP or stdio
// Zero dependencies — uses bun's built-in fetch and child_process
//
// Protocol: JSON-RPC 2.0 over streamable-http (2024-11-05) or stdio
// https://modelcontextprotocol.io/specification/2024-11-05/basic/transports

import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { minimalChildEnv } from '../workspace/environment';

// --- Types ---

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPCallArgs {
  [key: string]: unknown;
}

export interface MCPCallResult {
  content: Array<{ type: string; text?: string; data?: string }>;
  isError?: boolean;
}

// --- HTTP Transport ---

async function httpRequest(url: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
  const id = Math.random().toString(36).slice(2);
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`MCP HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    // SSE response — extract JSON-RPC from data: lines
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.id === id) return parsed.result;
        } catch {}
      }
    }
    throw new Error('No matching response in SSE stream');
  }

  // Plain JSON response
  const json = await res.json() as Record<string, unknown>;
  if (json.error) throw new Error(String((json.error as Record<string, string>)?.message || json.error));
  return json.result;
}

// --- Stdio Transport ---

class StdioTransport {
  private proc: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  async connect(command: string, args: string[], env: Record<string, string | undefined> = {}): Promise<void> {
    this.proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: minimalChildEnv(env),
    });

    const rl = createInterface({ input: this.proc.stdout! });

    rl.on('line', (line: string) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || 'MCP error'));
          else resolve(msg.result);
        }
      } catch {}
    });

    this.proc.stderr?.on('data', () => {}); // suppress stderr

    // Initialize
    await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'dotdog', version: '0.8.5' },
    });

    // Send initialized notification
    this.proc.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.proc?.stdin) throw new Error('Stdio transport not connected');

    const id = ++this.requestId;
    const req = JSON.stringify({ jsonrpc: '2.0', id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc!.stdin!.write(req + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP stdio timeout: ${method}`));
        }
      }, 15000);
    });
  }

  disconnect(): void {
    this.proc?.kill();
    this.proc = null;
  }
}

// --- Public API ---

export interface MCPConnection {
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, args: MCPCallArgs): Promise<MCPCallResult>;
  close(): void;
}

export async function connectHTTP(serverUrl: string): Promise<MCPConnection> {
  // Initialize session
  await httpRequest(serverUrl, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'dotdog', version: '0.8.5' },
  });

  return {
    async listTools(): Promise<MCPTool[]> {
      const result = await httpRequest(serverUrl, 'tools/list');
      return ((result as Record<string, unknown>)?.tools || []) as MCPTool[];
    },

    async callTool(name: string, args: MCPCallArgs): Promise<MCPCallResult> {
      const result = await httpRequest(serverUrl, 'tools/call', { name, arguments: args });
      return result as MCPCallResult;
    },

    close(): void { /* HTTP is stateless */ },
  };
}

export async function connectStdio(command: string, args: string[], env: Record<string, string | undefined> = {}): Promise<MCPConnection> {
  const transport = new StdioTransport();
  await transport.connect(command, args, env);

  return {
    async listTools(): Promise<MCPTool[]> {
      const result = await transport.send('tools/list');
      return ((result as Record<string, unknown>)?.tools || []) as MCPTool[];
    },

    async callTool(name: string, args: MCPCallArgs): Promise<MCPCallResult> {
      const result = await transport.send('tools/call', { name, arguments: args });
      return result as MCPCallResult;
    },

    close(): void { transport.disconnect(); },
  };
}
