import * as Lark from "@larksuiteoapi/node-sdk";

export interface FeishuMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
}

export type MessageHandler = (message: FeishuMessage) => void;

/**
 * Feishu bot adapter using WebSocket long-connection.
 * Receives messages via event subscription and sends replies through the
 * server-side API, avoiding the need for a public IP or webhook endpoint.
 */
export class FeishuAdapter {
  private client: InstanceType<typeof Lark.Client>;
  private wsClient: InstanceType<typeof Lark.WSClient>;
  private handler: MessageHandler | null = null;

  constructor(appId: string, appSecret: string) {
    const baseConfig = { appId, appSecret };
    this.client = new Lark.Client(baseConfig);
    this.wsClient = new Lark.WSClient({
      ...baseConfig,
      loggerLevel: Lark.LoggerLevel.info,
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    const self = this;

    await this.wsClient.start({
      eventDispatcher: new Lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (data: any) => {
          if (!self.handler) return;

          const message = data.message;
          if (!message) return;

          // Skip non-text messages
          if (message.message_type !== "text") return;

          let text: string;
          try {
            text = JSON.parse(message.content).text;
          } catch {
            return;
          }

          // Strip @bot mentions (group chats include @_user_N tokens)
          if (message.mentions && Array.isArray(message.mentions)) {
            for (const mention of message.mentions) {
              if (mention.key) {
                text = text.replace(mention.key, "").trim();
              }
            }
          }

          if (!text) return;

          const feishuMsg: FeishuMessage = {
            messageId: message.message_id,
            chatId: message.chat_id,
            senderId: data.sender?.sender_id?.open_id ?? "",
            text,
          };

          // Fire-and-forget: return immediately so the SDK ACKs within 3 s
          self.handler(feishuMsg);
        },
      }),
    });

    console.log("[Feishu] WebSocket connected");
  }

  async sendText(chatId: string, text: string): Promise<void> {
    await this.client.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text }),
        msg_type: "text",
      },
    });
  }
}
