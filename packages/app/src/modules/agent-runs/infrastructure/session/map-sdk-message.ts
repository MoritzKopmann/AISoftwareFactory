import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type {
  SessionEntry,
  SessionToolResultPart,
} from '../../business/domain/types/session-entry.js';
import type { SessionEvent } from '../../business/domain/types/session-event.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type ContentBlock = Record<string, unknown>;
type TextBlock = ContentBlock & { readonly text: string };
type Base64ImageBlock = ContentBlock & { readonly source: Record<string, unknown> };
type StreamEvent = Extract<SDKMessage, { type: 'stream_event' }>['event'];
type TextDeltaEvent = Extract<StreamEvent, { type: 'content_block_delta' }> & {
  readonly delta: { readonly type: 'text_delta'; readonly text: string };
};

/** A message with a parent tool use comes from a subagent the main agent started. */
export function isFromMainAgent(message: { readonly parent_tool_use_id: string | null }): boolean {
  return message.parent_tool_use_id === null;
}

function isInjectedBySdk(message: { readonly isSynthetic?: boolean }): boolean {
  return message.isSynthetic === true;
}

function isTextBlock(block: ContentBlock): block is TextBlock {
  return block['type'] === 'text' && typeof block['text'] === 'string';
}

function isBase64ImageBlock(block: ContentBlock): block is Base64ImageBlock {
  return (
    block['type'] === 'image' && isRecord(block['source']) && block['source']['type'] === 'base64'
  );
}

function yieldsPrompts(role: 'user' | 'assistant', includePrompts: boolean): boolean {
  return role === 'user' && includePrompts;
}

function startsTextBlock(event: StreamEvent): boolean {
  return event.type === 'content_block_start' && event.content_block.type === 'text';
}

function isTextDelta(event: StreamEvent): event is TextDeltaEvent {
  return event.type === 'content_block_delta' && event.delta.type === 'text_delta';
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
    if (isTextBlock(block)) {
      parts.push({ kind: 'text', text: block.text });
    } else if (isBase64ImageBlock(block)) {
      parts.push({
        kind: 'image',
        mediaType: String(block.source['media_type']),
        data: String(block.source['data']),
      });
    }
  }
  return parts;
}

const CLI_COMMAND =
  /^<command-message>[^]*?<\/command-message>\n<command-name>([^]*?)<\/command-name>(?:\n<command-args>([^]*)<\/command-args>)?$/;

/** The CLI stores a slash command as tagged text. This turns it back into `/<name> <args>`. */
function promptText(content: string): string {
  const match = CLI_COMMAND.exec(content);
  if (match === null) {
    return content;
  }
  const [, name = '', args = ''] = match;
  return args === '' ? name : `${name} ${args}`;
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
    return yieldsPrompts(role, includePrompts)
      ? [{ kind: 'prompt', id: `${uuid}#0`, text: promptText(content) }]
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
    if (role === 'assistant' && isTextBlock(block)) {
      entries.push({ kind: 'text', id, text: block.text });
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
    } else if (yieldsPrompts(role, includePrompts) && isTextBlock(block)) {
      entries.push({ kind: 'prompt', id, text: block.text });
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
  if (!isFromMainAgent(message)) {
    return [];
  }
  const { event } = message;
  if (startsTextBlock(event)) {
    streamState.opensNextTextBlock = true;
  } else if (isTextDelta(event)) {
    const opensBlock = streamState.opensNextTextBlock;
    streamState.opensNextTextBlock = false;
    return [{ kind: 'text-delta', opensBlock, text: event.delta.text }];
  }
  return [];
}

export function mapSdkMessage(
  message: SDKMessage,
  streamState: StreamState = createStreamState(),
): ReadonlyArray<SessionEvent> {
  if (message.type === 'stream_event') {
    return mapStreamEvent(message, streamState);
  }

  if (message.type === 'assistant') {
    const entries = isFromMainAgent(message)
      ? entriesFromContent(message.uuid, 'assistant', message.message.content, false)
      : [];
    return entries.map((entry): SessionEvent => ({ kind: 'entry', entry }));
  }

  if (message.type === 'user') {
    if (!isFromMainAgent(message) || isInjectedBySdk(message)) {
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
