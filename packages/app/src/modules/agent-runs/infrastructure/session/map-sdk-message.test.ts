import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEvent } from '../../business/domain/types/session-event.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createStreamState, entriesFromContent, mapSdkMessage } from './map-sdk-message.js';

function message(partial: Record<string, unknown>): SDKMessage {
  return partial as unknown as SDKMessage;
}

function assistantMessage(...content: Array<Record<string, unknown>>): SDKMessage {
  return message({
    type: 'assistant',
    uuid: 'm1',
    parent_tool_use_id: null,
    message: { role: 'assistant', content },
  });
}

describe('mapSdkMessage', () => {
  it('should map an assistant tool call to its entry only when the main agent calls a tool', () => {
    const events = mapSdkMessage(
      assistantMessage({
        type: 'tool_use',
        id: 't1',
        name: 'Bash',
        input: { command: 'npm test' },
      }),
    );

    expect(events.map(({ kind }) => kind)).toEqual(['entry']);
  });

  function rateLimitMessage(info: Record<string, unknown>): SDKMessage {
    return message({ type: 'rate_limit_event', rate_limit_info: info });
  }

  it('should map the windows to a window observation with percent and ISO reset when allowed', () => {
    const events = mapSdkMessage(liveFixture.map(message)[2] as SDKMessage);

    expect(events).toEqual([
      {
        kind: 'window-observed',
        fiveHour: { utilizationPercent: 6, resetsAt: '2026-10-17T16:00:00.000Z' },
        sevenDay: { utilizationPercent: 35, resetsAt: '2026-10-18T09:00:00.000Z' },
        refusal: null,
      },
    ]);
  });

  it('should map a missing window to null when unifiedWindows has no seven_day', () => {
    const events = mapSdkMessage(
      rateLimitMessage({
        status: 'allowed',
        unifiedWindows: { five_hour: { utilization: 0.5, resetsAt: 1792252800 } },
      }),
    );

    expect(events).toEqual([
      {
        kind: 'window-observed',
        fiveHour: { utilizationPercent: 50, resetsAt: '2026-10-17T16:00:00.000Z' },
        sevenDay: null,
        refusal: null,
      },
    ]);
  });

  it('should map a refusal with the window and rate_limit_info resetsAt when overage is rejected', () => {
    const events = mapSdkMessage(
      rateLimitMessage({
        status: 'rejected',
        overageStatus: 'rejected',
        rateLimitType: 'five_hour',
        resetsAt: 1790628600,
      }),
    );

    expect(events).toEqual([
      {
        kind: 'window-observed',
        fiveHour: null,
        sevenDay: null,
        refusal: { window: 'five_hour', resetsAt: '2026-09-28T20:50:00.000Z' },
      },
    ]);
  });

  it('should use the reset of the rateLimitType window when a refusal has no resetsAt', () => {
    const events = mapSdkMessage(
      rateLimitMessage({
        status: 'rejected',
        overageStatus: 'rejected',
        rateLimitType: 'five_hour',
        unifiedWindows: { five_hour: { utilization: 1, resetsAt: 1792252800 } },
      }),
    );

    expect(events[0]).toMatchObject({
      refusal: { window: 'five_hour', resetsAt: '2026-10-17T16:00:00.000Z' },
    });
  });

  it('should map a refusal reset to null when no reset time is known', () => {
    const events = mapSdkMessage(
      rateLimitMessage({
        status: 'rejected',
        overageStatus: 'rejected',
        rateLimitType: 'five_hour',
      }),
    );

    expect(events[0]).toMatchObject({ refusal: { window: 'five_hour', resetsAt: null } });
  });

  it('should map no refusal when overage is allowed', () => {
    const events = mapSdkMessage(
      rateLimitMessage({
        status: 'rejected',
        overageStatus: 'allowed',
        rateLimitType: 'five_hour',
      }),
    );

    expect(events[0]).toMatchObject({ refusal: null });
  });

  it('should map no refusal when overage only warns', () => {
    const events = mapSdkMessage(
      rateLimitMessage({
        status: 'rejected',
        overageStatus: 'allowed_warning',
        rateLimitType: 'five_hour',
      }),
    );

    expect(events[0]).toMatchObject({ refusal: null });
  });

  it('should map an error result to a crashed event with its errors', () => {
    const events = mapSdkMessage(
      message({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        errors: ['Login expired', 'Run /login'],
      }),
    );

    expect(events).toEqual([{ kind: 'crashed', reason: 'Login expired; Run /login' }]);
  });

  it('should map a failed success result to a crashed event with its text', () => {
    const events = mapSdkMessage(
      message({ type: 'result', subtype: 'success', is_error: true, result: 'API error 500' }),
    );

    expect(events).toEqual([{ kind: 'crashed', reason: 'API error 500' }]);
  });

  it('should map nothing when the result is a success', () => {
    const events = mapSdkMessage(
      message({ type: 'result', subtype: 'success', is_error: false, result: 'Done' }),
    );

    expect(events).toEqual([]);
  });

  it('should map nothing when the message is a user or system message', () => {
    expect(mapSdkMessage(message({ type: 'user', message: { content: [] } }))).toEqual([]);
    expect(mapSdkMessage(message({ type: 'system', subtype: 'init' }))).toEqual([]);
  });
});

function entriesOf(events: ReadonlyArray<SessionEvent>): ReadonlyArray<SessionEvent> {
  return events.filter((event) => event.kind === 'entry');
}

function streamEvent(event: Record<string, unknown>, parentToolUseId: string | null = null) {
  return message({ type: 'stream_event', event, parent_tool_use_id: parentToolUseId });
}

function textDelta(text: string) {
  return streamEvent({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text },
  });
}

describe('mapSdkMessage entries', () => {
  it('should yield a text entry with the full text and the id uuid#index when an assistant message has a text block', () => {
    const events = mapSdkMessage(
      message({
        type: 'assistant',
        uuid: 'u1',
        parent_tool_use_id: null,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'First line.\nSecond line.' }],
        },
      }),
    );

    expect(entriesOf(events)).toEqual([
      { kind: 'entry', entry: { kind: 'text', id: 'u1#0', text: 'First line.\nSecond line.' } },
    ]);
  });

  it('should yield a tool-call entry with the full input when an assistant message has a tool_use block', () => {
    const input = { command: 'npm test', description: 'Run the tests', extra: { a: [1, 2] } };
    const events = mapSdkMessage(
      message({
        type: 'assistant',
        uuid: 'u2',
        parent_tool_use_id: null,
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Running.' },
            { type: 'tool_use', id: 'toolu_1', name: 'Bash', input },
          ],
        },
      }),
    );

    expect(entriesOf(events)).toContainEqual({
      kind: 'entry',
      entry: { kind: 'tool-call', id: 'u2#1', toolUseId: 'toolu_1', name: 'Bash', input },
    });
  });

  it('should keep the whole text of a long multi-line tool result when a user message has a tool_result block', () => {
    const text = `${'line of output '.repeat(20)}\nsecond line\nthird line`;
    const events = mapSdkMessage(
      message({
        type: 'user',
        uuid: 'u3',
        parent_tool_use_id: null,
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: text }],
        },
      }),
    );

    expect(events).toEqual([
      {
        kind: 'entry',
        entry: {
          kind: 'tool-result',
          id: 'u3#0',
          toolUseId: 'toolu_1',
          isError: false,
          parts: [{ kind: 'text', text }],
        },
      },
    ]);
  });

  it('should yield an image part with media type and data when a tool_result holds an image block', () => {
    const events = mapSdkMessage(
      message({
        type: 'user',
        uuid: 'u4',
        parent_tool_use_id: null,
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_2',
              is_error: true,
              content: [
                { type: 'text', text: 'Shot taken' },
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
                },
              ],
            },
          ],
        },
      }),
    );

    expect(events).toEqual([
      {
        kind: 'entry',
        entry: {
          kind: 'tool-result',
          id: 'u4#0',
          toolUseId: 'toolu_2',
          isError: true,
          parts: [
            { kind: 'text', text: 'Shot taken' },
            { kind: 'image', mediaType: 'image/png', data: 'AAAA' },
          ],
        },
      },
    ]);
  });

  it('should yield no entry when the assistant message belongs to a subagent', () => {
    const events = mapSdkMessage(
      message({
        type: 'assistant',
        uuid: 'u5',
        parent_tool_use_id: 'toolu_9',
        message: { role: 'assistant', content: [{ type: 'text', text: 'inner' }] },
      }),
    );

    expect(entriesOf(events)).toEqual([]);
  });

  it('should yield no entry when the assistant block is thinking', () => {
    const events = mapSdkMessage(
      message({
        type: 'assistant',
        uuid: 'u6',
        parent_tool_use_id: null,
        message: {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'hmm', signature: 's' }],
        },
      }),
    );

    expect(entriesOf(events)).toEqual([]);
  });

  it('should yield no entry when a user message is synthetic', () => {
    const events = mapSdkMessage(
      message({
        type: 'user',
        uuid: 'u7',
        parent_tool_use_id: null,
        isSynthetic: true,
        message: { role: 'user', content: [{ type: 'text', text: 'skill body' }] },
      }),
    );

    expect(events).toEqual([]);
  });
});

describe('mapSdkMessage text deltas', () => {
  it('should yield a text-delta per delta with opensBlock only on the first when one text block streams', () => {
    const streamState = createStreamState();
    const events = [
      streamEvent({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
      textDelta('Hel'),
      textDelta('lo '),
      textDelta('world'),
    ].flatMap((streamed) => mapSdkMessage(streamed, streamState));

    expect(events).toEqual([
      { kind: 'text-delta', opensBlock: true, text: 'Hel' },
      { kind: 'text-delta', opensBlock: false, text: 'lo ' },
      { kind: 'text-delta', opensBlock: false, text: 'world' },
    ]);
  });

  it('should open a block again when a second text block starts', () => {
    const streamState = createStreamState();
    const start = streamEvent({
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'text', text: '' },
    });
    const events = [textDelta('a'), start, textDelta('b')].flatMap((streamed) =>
      mapSdkMessage(streamed, streamState),
    );

    expect(events.map((event) => event.kind === 'text-delta' && event.opensBlock)).toEqual([
      true,
      true,
    ]);
  });

  it('should drop thinking deltas, input_json deltas and subagent deltas', () => {
    const streamState = createStreamState();
    const events = [
      streamEvent({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'x' },
      }),
      streamEvent({
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{' },
      }),
      streamEvent(
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'inner' } },
        'toolu_9',
      ),
    ].flatMap((streamed) => mapSdkMessage(streamed, streamState));

    expect(events).toEqual([]);
  });
});

describe('entriesFromContent', () => {
  const promptText = (content: string): unknown =>
    entriesFromContent('u1', 'user', content, true)[0];
  const asPrompt = (text: string): unknown => ({ kind: 'prompt', id: 'u1#0', text });
  const cli = (name: string, args?: string): string =>
    `<command-message>${name.slice(1)}</command-message>\n<command-name>${name}</command-name>` +
    (args === undefined ? '' : `\n<command-args>${args}</command-args>`);

  it('should yield the slash command as prompt text when the string is the CLI command form', () => {
    expect(promptText(cli('/aisf:plan-ticket', '31'))).toEqual(asPrompt('/aisf:plan-ticket 31'));
  });

  it('should yield the command name alone when the CLI command form has no args', () => {
    expect(promptText(cli('/aisf:plan-ticket'))).toEqual(asPrompt('/aisf:plan-ticket'));
  });

  it('should keep multi-line args verbatim when the CLI command form has them', () => {
    expect(promptText(cli('/aisf:spike', '134\nmore text'))).toEqual(
      asPrompt('/aisf:spike 134\nmore text'),
    );
  });

  it('should keep the text unchanged when a command tag sits inside other text', () => {
    const text = 'before <command-name>/x</command-name> after';
    expect(promptText(text)).toEqual(asPrompt(text));
  });
});

function readFixture(name: string): Array<Record<string, unknown>> {
  const url = new URL(`../../testing/fixtures/sessions/${name}`, import.meta.url);
  return readFileSync(url, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

const liveFixture = readFixture('handbacks-live.jsonl');
const storedFixture = readFixture('handbacks-stored.jsonl');

function isHandbackMessage(entry: Record<string, unknown>): boolean {
  const origin = entry['origin'] as { handback?: boolean } | undefined;
  return entry['type'] === 'user' && origin?.handback === true;
}

const handbackUuid = '3d4118bc-8883-4f7c-b124-6e223dc85e8d';

function handbackMessage(origin: Record<string, unknown>, type = 'user'): SDKMessage {
  return message({
    type,
    uuid: 'h1',
    parent_tool_use_id: null,
    isSynthetic: true,
    message: { role: 'user', content: 'frame' },
    origin,
  });
}

describe('handback entries', () => {
  it('should yield one handback entry per handback and no prompt when entriesFromContent maps the stored fixture', () => {
    const handbacks = storedFixture.filter(isHandbackMessage);

    const entries = handbacks.flatMap((stored) =>
      entriesFromContent(
        String(stored['uuid']),
        'user',
        (stored['message'] as { content: unknown }).content,
        true,
        stored['origin'],
      ),
    );

    expect(handbacks).toHaveLength(3);
    expect(entries).toEqual(
      handbacks.map((stored) => {
        const origin = stored['origin'] as { from: string; handbackReportText: string };
        return {
          kind: 'handback',
          id: `${String(stored['uuid'])}#0`,
          agentId: origin.from,
          text: origin.handbackReportText,
        };
      }),
    );
  });

  it('should emit the same handback entry as the stored path when a live synthetic handback arrives', () => {
    const live = liveFixture.find((entry) => entry['uuid'] === handbackUuid);
    const stored = storedFixture.find((entry) => entry['uuid'] === handbackUuid);

    const events = mapSdkMessage(live as unknown as SDKMessage);

    expect(events).toEqual([
      {
        kind: 'entry',
        entry: entriesFromContent(
          handbackUuid,
          'user',
          (stored?.['message'] as { content: unknown }).content,
          true,
          stored?.['origin'],
        )[0],
      },
    ]);
    expect(events[0]).toMatchObject({ entry: { kind: 'handback', agentId: 'a6cdb2946e5157d4b' } });
  });

  it('should use the body without its frame line and indent when the origin has no handbackReportText', () => {
    const events = mapSdkMessage(
      handbackMessage({
        kind: 'peer',
        from: 'a1',
        handback: true,
        body: '[Subagent hand-back] The text below …\n  Line one\n    Line two',
      }),
    );

    expect(events).toEqual([
      {
        kind: 'entry',
        entry: { kind: 'handback', id: 'h1#0', agentId: 'a1', text: 'Line one\n  Line two' },
      },
    ]);
  });

  it('should set agentId null when the origin has no sender id', () => {
    const events = mapSdkMessage(
      handbackMessage({ kind: 'peer', handback: true, handbackReportText: 'x' }),
    );

    expect(events).toMatchObject([{ entry: { kind: 'handback', agentId: null } }]);
  });

  it('should emit no handback entry when a result message carries a handback origin', () => {
    const events = mapSdkMessage(
      message({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: '',
        origin: { kind: 'peer', handback: true, handbackReportText: 'x' },
      }),
    );

    expect(events).toEqual([]);
  });

  it('should emit no entries when the live replayed prompt and task notifications arrive', () => {
    const dropped = liveFixture.filter(
      (entry) =>
        entry['type'] === 'user' &&
        !isHandbackMessage(entry) &&
        (entry['isReplay'] === true ||
          (entry['origin'] as { kind?: string } | undefined)?.kind === 'task-notification'),
    );

    const events = dropped.flatMap((entry) => mapSdkMessage(entry as unknown as SDKMessage));

    expect(dropped.length).toBeGreaterThanOrEqual(2);
    expect(events).toEqual([]);
  });
});

describe('entriesFromContent agentId on tool results', () => {
  function resultFor(text: string) {
    return entriesFromContent(
      'u1',
      'user',
      [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text }] }],
      false,
    )[0];
  }

  it('should tag the result with the agent id when a background launch result has an agentId line', () => {
    const entry = resultFor('Async agent launched\nagentId: a6cdb2946e5157d4b (internal ID)\nmore');

    expect(entry).toMatchObject({ kind: 'tool-result', agentId: 'a6cdb2946e5157d4b' });
  });

  it('should tag the result with the agent id when a foreground result names the message sender', () => {
    const entry = resultFor('was delivered as a message from "a715d9ff1a28ad5d1" (its call)');

    expect(entry).toMatchObject({ kind: 'tool-result', agentId: 'a715d9ff1a28ad5d1' });
  });

  it('should leave agentId off when the result text matches neither pattern', () => {
    const entry = resultFor('plain output');

    expect(entry).not.toHaveProperty('agentId');
  });
});
