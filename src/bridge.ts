import { ACPClient } from "./acp/client.js";
import { AgentRegistry } from "./acp/registry.js";
import { FeishuAdapter, type FeishuMessage } from "./feishu/adapter.js";
import { formatResponse } from "./feishu/formatter.js";
import type { AppConfig } from "./config.js";

export class Bridge {
  private config: AppConfig;
  private registry: AgentRegistry;
  private feishu: FeishuAdapter;
  private acpClient: ACPClient | null = null;
  private activeAgentId: string;
  private busy = false;
  private seenMessages = new Set<string>();

  constructor(config: AppConfig) {
    this.config = config;
    this.registry = new AgentRegistry(config.agents);
    this.feishu = new FeishuAdapter(
      config.feishu.appId,
      config.feishu.appSecret,
    );
    this.activeAgentId = config.activeAgent;
  }

  async start(): Promise<void> {
    this.feishu.onMessage((msg) => this.handleMessage(msg));
    await this.feishu.start();

    await this.startAgent(this.activeAgentId);

    console.log("[Bridge] Ready — send a message in Feishu to get started");
  }

  // ----- agent lifecycle -----

  private async startAgent(agentId: string): Promise<void> {
    if (this.acpClient) {
      await this.acpClient.stop();
      this.acpClient = null;
    }

    const agentConfig = this.registry.get(agentId);
    if (!agentConfig) {
      throw new Error(`Agent "${agentId}" not found in agents.config.json`);
    }

    this.acpClient = new ACPClient(agentConfig, this.config.workingDirectory);
    await this.acpClient.start();
    this.activeAgentId = agentId;
  }

  // ----- incoming message handling -----

  private async handleMessage(msg: FeishuMessage): Promise<void> {
    // Deduplicate (Feishu may re-push on slow ACK)
    if (this.seenMessages.has(msg.messageId)) return;
    this.seenMessages.add(msg.messageId);
    if (this.seenMessages.size > 500) this.seenMessages.clear();

    try {
      const text = msg.text.trim();
      if (!text) return;

      if (text.startsWith("/")) {
        await this.handleCommand(msg, text);
      } else {
        await this.handlePrompt(msg, text);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Bridge] Unhandled error:", errMsg);
      await this.safeSend(msg.chatId, `Error: ${errMsg}`);
    }
  }

  private async handlePrompt(msg: FeishuMessage, text: string): Promise<void> {
    if (this.busy) {
      await this.safeSend(msg.chatId, "⏳ 正在处理上一条消息，请稍候...");
      return;
    }

    if (!this.acpClient) {
      await this.safeSend(
        msg.chatId,
        "Agent 未启动，请使用 /switch <agent> 启动",
      );
      return;
    }

    this.busy = true;
    try {
      const result = await this.acpClient.prompt(text);
      const chunks = formatResponse(result);
      for (const chunk of chunks) {
        await this.safeSend(msg.chatId, chunk);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.safeSend(msg.chatId, `Agent 错误: ${errMsg}`);
    } finally {
      this.busy = false;
    }
  }

  // ----- slash commands -----

  private async handleCommand(msg: FeishuMessage, text: string): Promise<void> {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ");

    switch (cmd.toLowerCase()) {
      case "/switch":
        await this.cmdSwitch(msg, arg);
        break;
      case "/reset":
        await this.cmdReset(msg);
        break;
      case "/status":
        await this.cmdStatus(msg);
        break;
      case "/help":
        await this.cmdHelp(msg);
        break;
      default:
        await this.safeSend(
          msg.chatId,
          `未知命令: ${cmd}\n输入 /help 查看可用命令`,
        );
    }
  }

  private async cmdSwitch(msg: FeishuMessage, arg: string): Promise<void> {
    if (!arg) {
      const list = this.registry
        .list()
        .map((a) => `  ${a.id} — ${a.name}`)
        .join("\n");
      await this.safeSend(
        msg.chatId,
        `用法: /switch <agent>\n\n可用 agents:\n${list}`,
      );
      return;
    }

    if (!this.registry.has(arg)) {
      await this.safeSend(msg.chatId, `未知 agent: ${arg}`);
      return;
    }

    try {
      await this.safeSend(msg.chatId, `🔄 正在切换到 ${arg}...`);
      await this.startAgent(arg);
      await this.safeSend(
        msg.chatId,
        `✅ 已切换到 ${this.acpClient!.getAgentName()}`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.safeSend(msg.chatId, `切换失败: ${errMsg}`);
    }
  }

  private async cmdReset(msg: FeishuMessage): Promise<void> {
    try {
      await this.safeSend(msg.chatId, "🔄 正在重置会话...");
      await this.startAgent(this.activeAgentId);
      await this.safeSend(msg.chatId, "✅ 会话已重置");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.safeSend(msg.chatId, `重置失败: ${errMsg}`);
    }
  }

  private async cmdStatus(msg: FeishuMessage): Promise<void> {
    const name = this.acpClient?.getAgentName() ?? "未启动";
    await this.safeSend(
      msg.chatId,
      `📊 当前状态\nAgent: ${name}\nAgent ID: ${this.activeAgentId}\n工作目录: ${this.config.workingDirectory}`,
    );
  }

  private async cmdHelp(msg: FeishuMessage): Promise<void> {
    await this.safeSend(
      msg.chatId,
      "📚 可用命令:\n" +
        "/switch <agent> — 切换 Agent（如 kimi、claude、gemini、codex）\n" +
        "/reset — 重置当前会话\n" +
        "/status — 查看当前状态\n" +
        "/help — 显示此帮助",
    );
  }

  // ----- utilities -----

  private async safeSend(chatId: string, text: string): Promise<void> {
    try {
      await this.feishu.sendText(chatId, text);
    } catch (err) {
      console.error("[Bridge] Failed to send Feishu message:", err);
    }
  }

  async stop(): Promise<void> {
    if (this.acpClient) {
      await this.acpClient.stop();
    }
  }
}
