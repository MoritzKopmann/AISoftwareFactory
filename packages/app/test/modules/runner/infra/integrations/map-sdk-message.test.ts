import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { mapSdkMessage } from '../../../../../src/modules/runner/infra/integrations/map-sdk-message.js';

const at = '2026-09-29T10:00:00.000Z';

function message(partial: Record<string, unknown>): SDKMessage {
  return partial as unknown as SDKMessage;
}

function assistantMessage(...content: Array<Record<string, unknown>>): SDKMessage {
  return message({ type: 'assistant', message: { role: 'assistant', content } });
}

describe('mapSdkMessage', () => {
  it('should map a Bash tool call to a step naming the tool and the command', () => {
    const events = mapSdkMessage(
      assistantMessage({
        type: 'tool_use',
        id: 't1',
        name: 'Bash',
        input: { command: 'npm test', description: 'Run the tests' },
      }),
      at,
    );

    expect(events).toEqual([{ kind: 'step', step: { at, summary: 'Bash: npm test' } }]);
  });

  it('should map a file tool call to a step naming the file path', () => {
    const events = mapSdkMessage(
      assistantMessage({
        type: 'tool_use',
        id: 't2',
        name: 'Edit',
        input: { file_path: '/worktrees/aisf/137/src/main.ts', old_string: 'a', new_string: 'b' },
      }),
      at,
    );

    expect(events).toEqual([
      { kind: 'step', step: { at, summary: 'Edit: /worktrees/aisf/137/src/main.ts' } },
    ]);
  });

  it('should map a tool call without a recognised input to a step naming only the tool', () => {
    const events = mapSdkMessage(
      assistantMessage({ type: 'tool_use', id: 't3', name: 'TodoWrite', input: { todos: [] } }),
      at,
    );

    expect(events).toEqual([{ kind: 'step', step: { at, summary: 'TodoWrite' } }]);
  });

  it('should map assistant text to a step with its first line when the text has several lines', () => {
    const events = mapSdkMessage(
      assistantMessage({ type: 'text', text: 'Reading the ticket now.\nThen the code.' }),
      at,
    );

    expect(events).toEqual([{ kind: 'step', step: { at, summary: 'Reading the ticket now.' } }]);
  });

  it('should shorten a step summary to 120 characters when the command is long', () => {
    const events = mapSdkMessage(
      assistantMessage({
        type: 'tool_use',
        id: 't4',
        name: 'Bash',
        input: { command: 'x'.repeat(300) },
      }),
      at,
    );

    expect(events[0]).toMatchObject({ kind: 'step' });
    expect((events[0] as { step: { summary: string } }).step.summary).toHaveLength(120);
  });

  it('should map a rejected rate limit to a usage-limit event naming the window', () => {
    const events = mapSdkMessage(
      message({
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour', resetsAt: 1790628600 },
      }),
      at,
    );

    expect(events).toEqual([
      {
        kind: 'usage-limit',
        reason: 'The five_hour usage limit was reached (resets at 2026-09-28T20:50:00.000Z)',
      },
    ]);
  });

  it('should map nothing when the rate limit only warns', () => {
    const events = mapSdkMessage(
      message({
        type: 'rate_limit_event',
        rate_limit_info: { status: 'allowed_warning', rateLimitType: 'five_hour' },
      }),
      at,
    );

    expect(events).toEqual([]);
  });

  it('should map an error result to a crashed event with its errors', () => {
    const events = mapSdkMessage(
      message({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['Login expired', 'Run /login'],
      }),
      at,
    );

    expect(events).toEqual([{ kind: 'crashed', reason: 'Login expired; Run /login' }]);
  });

  it('should map a failed success result to a crashed event with its text', () => {
    const events = mapSdkMessage(
      message({ type: 'result', subtype: 'success', is_error: true, result: 'API error 500' }),
      at,
    );

    expect(events).toEqual([{ kind: 'crashed', reason: 'API error 500' }]);
  });

  it('should map nothing when the result is a success', () => {
    const events = mapSdkMessage(
      message({ type: 'result', subtype: 'success', is_error: false, result: 'Done' }),
      at,
    );

    expect(events).toEqual([]);
  });

  it('should map nothing when the message is a user or system message', () => {
    expect(mapSdkMessage(message({ type: 'user', message: { content: [] } }), at)).toEqual([]);
    expect(mapSdkMessage(message({ type: 'system', subtype: 'init' }), at)).toEqual([]);
  });
});
