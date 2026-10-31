import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

/** Open user-message input of one session. Pushes and the close are synchronous, so atomic. */
export class SessionInput implements AsyncIterable<SDKUserMessage> {
  private readonly pending: SDKUserMessage[] = [];
  private waiting: ((result: IteratorResult<SDKUserMessage>) => void) | undefined;
  private closed = false;

  push(message: SDKUserMessage): 'pushed' | 'closed' {
    if (this.closed) {
      return 'closed';
    }
    const resolve = this.waiting;
    if (resolve === undefined) {
      this.pending.push(message);
    } else {
      this.waiting = undefined;
      resolve({ value: message, done: false });
    }
    return 'pushed';
  }

  close(): void {
    this.closed = true;
    const resolve = this.waiting;
    this.waiting = undefined;
    resolve?.({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: () => {
        const message = this.pending.shift();
        if (message !== undefined) {
          return Promise.resolve({ value: message, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => {
          this.waiting = resolve;
        });
      },
    };
  }
}
