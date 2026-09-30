import type { SDKAssistantMessage, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEvent } from '../../logic/domain/types/session-event.js';

const maximumSummaryLength = 120;
const inputFieldsThatDescribeACall = ['command', 'file_path', 'path', 'pattern', 'url'];

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

export function mapSdkMessage(message: SDKMessage, at: string): ReadonlyArray<SessionEvent> {
  if (message.type === 'assistant') {
    return describeAssistantMessage(message.message).map((summary) => ({
      kind: 'step',
      step: { at, summary },
    }));
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
