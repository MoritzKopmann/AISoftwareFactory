import type { AgentTool, AgentToolRegistry } from './agent-tools.js';

export class InMemoryAgentToolRegistry implements AgentToolRegistry {
  private readonly tools: AgentTool[] = [];

  register(tool: AgentTool): void {
    this.tools.push(tool);
  }

  list(): ReadonlyArray<AgentTool> {
    return [...this.tools];
  }
}
