import { describe, expect, it } from 'vitest';
import type { SessionEntry } from '../types/session-entry.js';
import { commandToLabel } from './command-to-label.js';

function toolCall(name: string, input: unknown): SessionEntry {
  return { kind: 'tool-call', id: 'm#0', toolUseId: 't1', name, input };
}

describe('commandToLabel', () => {
  it('should return the command when a Bash call has no description', () => {
    expect(commandToLabel(toolCall('Bash', { command: 'npm test' }))).toBe('npm test');
  });

  it('should return undefined when the Bash call has a description', () => {
    expect(
      commandToLabel(toolCall('Bash', { command: 'npm test', description: 'Run tests' })),
    ).toBeUndefined();
  });

  it('should return undefined when the call is not Bash', () => {
    expect(commandToLabel(toolCall('Read', { command: 'npm test' }))).toBeUndefined();
  });

  it('should return undefined when the entry is not a tool call', () => {
    expect(commandToLabel({ kind: 'text', id: 'm#0', text: 'npm test' })).toBeUndefined();
  });

  it('should return undefined when the Bash call has no string command', () => {
    expect(commandToLabel(toolCall('Bash', { command: 5 }))).toBeUndefined();
    expect(commandToLabel(toolCall('Bash', undefined))).toBeUndefined();
  });
});
