import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

export interface AgentConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface AppConfig {
  feishu: {
    appId: string;
    appSecret: string;
  };
  activeAgent: string;
  workingDirectory: string;
  agents: Record<string, AgentConfig>;
}

export function loadConfig(): AppConfig {
  loadDotenv();

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "Missing FEISHU_APP_ID or FEISHU_APP_SECRET in environment. " +
        "Copy .env.example to .env and fill in your credentials.",
    );
  }

  const configPath = resolve(process.cwd(), "agents.config.json");
  const raw = readFileSync(configPath, "utf-8");
  const agentsConfig = JSON.parse(raw) as {
    activeAgent: string;
    workingDirectory?: string;
    agents: Record<string, AgentConfig>;
  };

  if (!agentsConfig.agents || !agentsConfig.activeAgent) {
    throw new Error(
      "agents.config.json must contain 'activeAgent' and 'agents' fields",
    );
  }

  if (!agentsConfig.agents[agentsConfig.activeAgent]) {
    throw new Error(
      `Active agent "${agentsConfig.activeAgent}" not found in agents config`,
    );
  }

  return {
    feishu: { appId, appSecret },
    activeAgent: agentsConfig.activeAgent,
    workingDirectory: resolve(agentsConfig.workingDirectory || "."),
    agents: agentsConfig.agents,
  };
}
