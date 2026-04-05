import { spawn, type ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import type { AgentConfig } from "../config.js";

export interface ToolCallInfo {
  id: string;
  title: string;
  status: string;
}

export interface PromptResult {
  message: string;
  toolCalls: ToolCallInfo[];
  stopReason: string;
}

/**
 * Implements the ACP Client interface.
 * Collects streamed session updates during a prompt turn and auto-approves
 * permission requests (suitable for personal / trusted environments).
 */
class ClientHandler implements acp.Client {
  private chunks: string[] = [];
  private tools = new Map<string, ToolCallInfo>();

  startCollecting(): void {
    this.chunks = [];
    this.tools = new Map();
  }

  getCollectedMessage(): string {
    return this.chunks.join("");
  }

  getToolCalls(): ToolCallInfo[] {
    return [...this.tools.values()];
  }

  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const allow = params.options.find(
      (o) => o.kind === "allow_always" || o.kind === "allow_once",
    );
    return {
      outcome: {
        outcome: "selected",
        optionId: (allow ?? params.options[0]).optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        if (update.content.type === "text") {
          this.chunks.push(update.content.text);
        }
        break;
      case "tool_call":
        this.tools.set(update.toolCallId, {
          id: update.toolCallId,
          title: update.title,
          status: update.status ?? "pending",
        });
        break;
      case "tool_call_update": {
        const existing = this.tools.get(update.toolCallId);
        if (existing) existing.status = update.status ?? existing.status;
        break;
      }
    }
  }

  async readTextFile(
    _params: acp.ReadTextFileRequest,
  ): Promise<acp.ReadTextFileResponse> {
    return { content: "" };
  }

  async writeTextFile(
    _params: acp.WriteTextFileRequest,
  ): Promise<acp.WriteTextFileResponse> {
    return {};
  }
}

/**
 * Wraps the ACP TypeScript SDK to manage an agent subprocess lifecycle:
 * spawn -> initialize -> session/new -> session/prompt.
 */
export class ACPClient {
  private agentProcess: ChildProcess | null = null;
  private connection: acp.ClientSideConnection | null = null;
  private handler = new ClientHandler();
  private sessionId: string | null = null;
  private agentConfig: AgentConfig;
  private cwd: string;

  constructor(agentConfig: AgentConfig, cwd: string) {
    this.agentConfig = agentConfig;
    this.cwd = cwd;
  }

  async start(): Promise<void> {
    const { command, args, env } = this.agentConfig;

    this.agentProcess = spawn(command, args, {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
    });

    this.agentProcess.on("error", (err) => {
      console.error(`[ACP] Agent process error: ${err.message}`);
    });

    this.agentProcess.on("exit", (code) => {
      console.log(`[ACP] Agent process exited (code ${code})`);
    });

    const input = Writable.toWeb(this.agentProcess.stdin!);
    const output = Readable.toWeb(
      this.agentProcess.stdout!,
    ) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);

    this.connection = new acp.ClientSideConnection(
      (_agent) => this.handler,
      stream,
    );

    const initResult = await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
      },
      clientInfo: {
        name: "lark-acp-bridge",
        title: "Feishu ACP Bridge",
        version: "0.1.0",
      },
    });

    console.log(
      `[ACP] Connected to ${this.agentConfig.name} ` +
        `(protocol v${initResult.protocolVersion})`,
    );

    const sessionResult = await this.connection.newSession({
      cwd: this.cwd,
      mcpServers: [],
    });

    this.sessionId = sessionResult.sessionId;
    console.log(`[ACP] Session created: ${this.sessionId}`);
  }

  async prompt(text: string): Promise<PromptResult> {
    if (!this.connection || !this.sessionId) {
      throw new Error("ACP client not started — call start() first");
    }

    this.handler.startCollecting();

    const result = await this.connection.prompt({
      sessionId: this.sessionId,
      prompt: [{ type: "text", text }],
    });

    return {
      message: this.handler.getCollectedMessage(),
      toolCalls: this.handler.getToolCalls(),
      stopReason: result.stopReason,
    };
  }

  async stop(): Promise<void> {
    if (this.agentProcess) {
      this.agentProcess.kill();
      this.agentProcess = null;
    }
    this.connection = null;
    this.sessionId = null;
  }

  getAgentName(): string {
    return this.agentConfig.name;
  }
}
