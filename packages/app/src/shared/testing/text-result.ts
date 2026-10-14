import type { AgentToolEnding, AgentToolResult } from '../agent-tools.js';

export function textResult(result: AgentToolResult): { text: string; ending?: AgentToolEnding } {
  if ('wait' in result) {
    throw new Error('Expected a text result but the tool returned a wait');
  }
  return result;
}
