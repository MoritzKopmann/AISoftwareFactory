import { describe, expect, it } from 'vitest';
import type { AgentTool } from './agent-tools.js';
import { InMemoryAgentToolRegistry } from './in-memory-agent-tool-registry.js';

function buildTool(name: string): AgentTool {
  return {
    name,
    description: name,
    inputShape: {},
    execute: async () => ({ text: name }),
  };
}

describe('InMemoryAgentToolRegistry', () => {
  it('should list no tools when none is registered', () => {
    expect(new InMemoryAgentToolRegistry().list()).toEqual([]);
  });

  it('should list the tools in registration order when several are registered', () => {
    const registry = new InMemoryAgentToolRegistry();
    const first = buildTool('first');
    const second = buildTool('second');

    registry.register(first);
    registry.register(second);

    expect(registry.list()).toEqual([first, second]);
  });
});
