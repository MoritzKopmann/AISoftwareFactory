import { describe, expect, it } from 'vitest';
import type { SessionEntry } from '../../../business/domain/types/session-entry.js';
import { sessionStreamFrameSchema } from '../api/session-stream-schemas.js';
import { toSessionStreamFrame } from './session-stream-mapper.js';

function mapEntry(entry: SessionEntry): unknown {
  const frame = toSessionStreamFrame({ kind: 'entry', entry });
  expect(sessionStreamFrameSchema.safeParse(frame).success).toBe(true);
  return frame.kind === 'entry' ? frame.entry : undefined;
}

describe('toSessionStreamFrame', () => {
  it('should pass a handback entry through unchanged when it names a subagent', () => {
    const entry: SessionEntry = { kind: 'handback', id: 'u1#0', agentId: 'a1', text: 'Report' };
    expect(mapEntry(entry)).toEqual({
      kind: 'handback',
      id: 'u1#0',
      agentId: 'a1',
      text: 'Report',
    });
  });

  it('should keep a null agentId when a handback has no subagent id', () => {
    const entry: SessionEntry = { kind: 'handback', id: 'u1#0', agentId: null, text: 'Report' };
    expect(mapEntry(entry)).toEqual({
      kind: 'handback',
      id: 'u1#0',
      agentId: null,
      text: 'Report',
    });
  });

  it('should keep the agentId when a tool result names a subagent', () => {
    const entry: SessionEntry = {
      kind: 'tool-result',
      id: 'u2#0',
      toolUseId: 't1',
      isError: false,
      parts: [],
      agentId: 'a1',
    };
    expect(mapEntry(entry)).toMatchObject({ kind: 'tool-result', agentId: 'a1' });
  });

  it('should omit the agentId key when a tool result has none', () => {
    const entry: SessionEntry = {
      kind: 'tool-result',
      id: 'u2#0',
      toolUseId: 't1',
      isError: false,
      parts: [],
    };
    expect(mapEntry(entry)).not.toHaveProperty('agentId');
  });
});
