import type { AgentToolEnding, AgentToolResult } from '../../../../src/shared/agent-tools.js';

export function textResult(result: AgentToolResult): { text: string; ending?: AgentToolEnding } {
  if ('wait' in result) {
    throw new Error('Expected a text result but the tool returned a wait');
  }
  return result;
}
