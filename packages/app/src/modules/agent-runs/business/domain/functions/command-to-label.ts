import type { SessionEntry } from '../types/session-entry.js';

type BashInput = { command?: unknown; description?: unknown };

function isBashCall(entry: SessionEntry): entry is Extract<SessionEntry, { kind: 'tool-call' }> {
  return entry.kind === 'tool-call' && entry.name === 'Bash';
}

function hasDescription(input: BashInput): boolean {
  return typeof input.description === 'string';
}

function isUndescribedCommand(input: BashInput): input is { command: string } {
  return typeof input.command === 'string' && !hasDescription(input);
}

/** The command to label, or undefined when the entry is not a Bash call lacking a description. */
export function commandToLabel(entry: SessionEntry): string | undefined {
  if (!isBashCall(entry)) {
    return undefined;
  }
  if (typeof entry.input !== 'object' || entry.input === null) {
    return undefined;
  }
  const input: BashInput = entry.input;
  return isUndescribedCommand(input) ? input.command : undefined;
}
