import type { PromptResult } from "../acp/client.js";

const MAX_TEXT_LENGTH = 4000;

/**
 * Converts an ACP prompt result into one or more Feishu-ready text strings.
 * Long messages are split at newline boundaries to stay within Feishu limits.
 */
export function formatResponse(result: PromptResult): string[] {
  let body = result.message.trim();

  if (!body && result.toolCalls.length === 0) {
    return ["(Agent 未返回内容)"];
  }

  const completedTools = result.toolCalls.filter(
    (tc) => tc.status === "completed",
  );
  if (completedTools.length > 0) {
    const summary = completedTools.map((tc) => `  - ${tc.title}`).join("\n");
    body = `[执行了 ${completedTools.length} 个工具调用]\n${summary}\n\n${body}`;
  }

  if (!body.trim()) {
    return ["(Agent 未返回内容)"];
  }

  return splitMessage(body.trim(), MAX_TEXT_LENGTH);
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitIdx = remaining.lastIndexOf("\n", maxLength);
    if (splitIdx <= 0) splitIdx = maxLength;
    chunks.push(remaining.substring(0, splitIdx));
    remaining = remaining.substring(splitIdx).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
