import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { SessionInput } from './session-input.js';

function aMessage(text: string): SDKUserMessage {
  return { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null };
}

describe('SessionInput', () => {
  it('should yield pushed messages in order when they were queued before reading', async () => {
    const input = new SessionInput();
    input.push(aMessage('a'));
    input.push(aMessage('b'));
    input.close();

    const texts: unknown[] = [];
    for await (const message of input) {
      texts.push(message.message.content);
    }

    expect(texts).toEqual(['a', 'b']);
  });

  it('should return closed when pushing after the close', () => {
    const input = new SessionInput();
    input.close();

    expect(input.push(aMessage('late'))).toBe('closed');
  });

  it('should end a waiting reader when closed', async () => {
    const input = new SessionInput();
    const next = input[Symbol.asyncIterator]().next();

    input.close();

    expect((await next).done).toBe(true);
  });

  it('should hand a message to a waiting reader when pushed', async () => {
    const input = new SessionInput();
    const next = input[Symbol.asyncIterator]().next();

    input.push(aMessage('hi'));

    expect((await next).value?.message.content).toBe('hi');
  });
});
