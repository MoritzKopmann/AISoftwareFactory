import type { SDKAssistantMessage, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type {
  SessionEntry,
  SessionToolResultPart,
} from '../../business/domain/types/session-entry.js';
import type { SessionEvent } from '../../business/domain/types/session-event.js';

const maximumSummaryLength = 120;
const inputFieldsThatDescribeACall: ReadonlyArray<string> = [
  'command',
  'file_path',
  'path',
  'pattern',
  'url',
];

function shorten(text: string): string {
  return text.length > maximumSummaryLength ? text.slice(0, maximumSummaryLength) : text;
}

function describeToolCall(toolName: string, input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    for (const field of inputFieldsThatDescribeACall) {
      const value = (input as Record<string, unknown>)[field];
      if (typeof value === 'string' && value !== '') {
        return shorten(`${toolName}: ${value}`);
      }
    }
  }
  return shorten(toolName);
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0] ?? '';
}

export function describeAssistantMessage(
  message: SDKAssistantMessage['message'],
): ReadonlyArray<string> {
  const summaries: string[] = [];
  for (const block of message.content) {
    if (block.type === 'tool_use') {
      summaries.push(describeToolCall(block.name, block.input));
    } else if (block.type === 'text' && firstLine(block.text) !== '') {
      summaries.push(shorten(firstLine(block.text)));
    }
  }
  return summaries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toolResultParts(content: unknown): ReadonlyArray<SessionToolResultPart> {
  if (typeof content === 'string') {
    return [{ kind: 'text', text: content }];
  }
  if (!Array.isArray(content)) {
    return [];
  }
  const parts: SessionToolResultPart[] = [];
  for (const block of content as ReadonlyArray<unknown>) {
    if (!isRecord(block)) {
      continue;
    }
    if (block['type'] === 'text' && typeof block['text'] === 'string') {
      parts.push({ kind: 'text', text: block['text'] });
    } else if (
      block['type'] === 'image' &&
      isRecord(block['source']) &&
      block['source']['type'] === 'base64'
    ) {
      parts.push({
        kind: 'image',
        mediaType: String(block['source']['media_type']),
        data: String(block['source']['data']),
      });
    }
  }
  return parts;
}

/**
 * The entries of one message's content blocks. Live and transcript share it, so a block gets the
 * same id on both paths. Prompts only come from the transcript; the live stream never carries them.
 */
export function entriesFromContent(
  uuid: string,
  role: 'user' | 'assistant',
  content: unknown,
  includePrompts: boolean,
): ReadonlyArray<SessionEntry> {
  if (typeof content === 'string') {
    return role === 'user' && includePrompts
      ? [{ kind: 'prompt', id: `${uuid}#0`, text: content }]
      : [];
  }
  if (!Array.isArray(content)) {
    return [];
  }
  const entries: SessionEntry[] = [];
  (content as ReadonlyArray<unknown>).forEach((block, index) => {
    if (!isRecord(block)) {
      return;
    }
    const id = `${uuid}#${index}`;
    if (role === 'assistant' && block['type'] === 'text' && typeof block['text'] === 'string') {
      entries.push({ kind: 'text', id, text: block['text'] });
    } else if (role === 'assistant' && block['type'] === 'tool_use') {
      entries.push({
        kind: 'tool-call',
        id,
        toolUseId: String(block['id']),
        name: String(block['name']),
        input: block['input'],
      });
    } else if (role === 'user' && block['type'] === 'tool_result') {
      entries.push({
        kind: 'tool-result',
        id,
        toolUseId: String(block['tool_use_id']),
        isError: block['is_error'] === true,
        parts: toolResultParts(block['content']),
      });
    } else if (
      role === 'user' &&
      includePrompts &&
      block['type'] === 'text' &&
      typeof block['text'] === 'string'
    ) {
      entries.push({ kind: 'prompt', id, text: block['text'] });
    }
  });
  return entries;
}

/** Tracks whether the next text delta opens a new text block. */
export type StreamState = { opensNextTextBlock: boolean };

export function createStreamState(): StreamState {
  return { opensNextTextBlock: true };
}

function mapStreamEvent(
  message: Extract<SDKMessage, { type: 'stream_event' }>,
  streamState: StreamState,
): ReadonlyArray<SessionEvent> {
  if (message.parent_tool_use_id !== null) {
    return [];
  }
  const { event } = message;
  if (event.type === 'content_block_start' && event.content_block.type === 'text') {
    streamState.opensNextTextBlock = true;
  } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    const opensBlock = streamState.opensNextTextBlock;
    streamState.opensNextTextBlock = false;
    return [{ kind: 'text-delta', opensBlock, text: event.delta.text }];
  }
  return [];
}

export function mapSdkMessage(
  message: SDKMessage,
  at: string,
  streamState: StreamState = createStreamState(),
): ReadonlyArray<SessionEvent> {
  if (message.type === 'stream_event') {
    return mapStreamEvent(message, streamState);
  }

  if (message.type === 'assistant') {
    const steps = describeAssistantMessage(message.message).map((summary): SessionEvent => ({
      kind: 'step',
      step: { at, summary },
    }));
    const entries =
      message.parent_tool_use_id === null
        ? entriesFromContent(message.uuid, 'assistant', message.message.content, false)
        : [];
    return [...steps, ...entries.map((entry): SessionEvent => ({ kind: 'entry', entry }))];
  }

  if (message.type === 'user') {
    if (message.parent_tool_use_id !== null || message.isSynthetic === true) {
      return [];
    }
    return entriesFromContent(message.uuid ?? '', 'user', message.message.content, false).map(
      (entry): SessionEvent => ({ kind: 'entry', entry }),
    );
  }

  if (message.type === 'rate_limit_event') {
    const { status, rateLimitType, resetsAt } = message.rate_limit_info;
    if (status !== 'rejected') {
      return [];
    }
    const window = rateLimitType ?? 'usage';
    const reset =
      resetsAt === undefined ? '' : ` (resets at ${new Date(resetsAt * 1000).toISOString()})`;
    return [{ kind: 'usage-limit', reason: `The ${window} usage limit was reached${reset}` }];
  }

  if (message.type === 'result') {
    if (message.subtype !== 'success') {
      const reason = message.errors.join('; ');
      return [{ kind: 'crashed', reason: reason === '' ? message.subtype : reason }];
    }
    return message.is_error ? [{ kind: 'crashed', reason: message.result }] : [];
  }

  return [];
}
