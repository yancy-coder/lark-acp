import type { AgentConfig } from "../config.js";

export class AgentRegistry {
  private agents: Record<string, AgentConfig>;

  constructor(agents: Record<string, AgentConfig>) {
    this.agents = agents;
  }

  get(id: string): AgentConfig | undefined {
    return this.agents[id];
  }

  has(id: string): boolean {
    return id in this.agents;
  }

  list(): { id: string; name: string }[] {
    return Object.entries(this.agents).map(([id, agent]) => ({
      id,
      name: agent.name,
    }));
  }
}
