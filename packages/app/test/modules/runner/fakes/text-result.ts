import type { RunEnding } from '../../../../src/modules/runner/logic/domain/types/run-ending.js';
import type { RunToolResult } from '../../../../src/modules/runner/logic/domain/types/run-tool.js';

export function textResult(result: RunToolResult): { text: string; ending?: RunEnding } {
  if ('wait' in result) {
    throw new Error('Expected a text result but the tool returned a wait');
  }
  return result;
}
