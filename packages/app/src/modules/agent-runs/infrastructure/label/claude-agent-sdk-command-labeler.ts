import { query } from '@anthropic-ai/claude-agent-sdk';
import { CommandLabelFailedError } from '../../business/errors/command-label-failed-error.js';
import type { CommandLabeler } from '../../business/port/label/command-labeler.js';

const systemPrompt =
  'Answer with one sentence of at most 100 chars saying what the given shell command does, nothing else.';

export type ClaudeAgentSdkCommandLabelerOptions = {
  readonly claudeExecutablePath: string;
  readonly timeoutMilliseconds: number;
};

export class ClaudeAgentSdkCommandLabeler implements CommandLabeler {
  constructor(private readonly options: ClaudeAgentSdkCommandLabelerOptions) {}

  async label(command: string): Promise<string> {
    const abortController = new AbortController();
    const timer = setTimeout(() => {
      abortController.abort();
    }, this.options.timeoutMilliseconds);

    try {
      const sdkQuery = query({
        prompt: command,
        options: {
          model: 'haiku',
          effort: 'low',
          thinking: { type: 'disabled' },
          maxTurns: 1,
          tools: [],
          settingSources: [],
          persistSession: false,
          systemPrompt,
          pathToClaudeCodeExecutable: this.options.claudeExecutablePath,
          abortController,
        },
      });

      for await (const message of sdkQuery) {
        if (message.type !== 'result') {
          continue;
        }
        if (message.subtype === 'success' && !message.is_error) {
          return message.result;
        }
        throw new CommandLabelFailedError(`Labeler ended with ${message.subtype}`);
      }
      throw new CommandLabelFailedError('Labeler produced no result');
    } catch (error) {
      if (error instanceof CommandLabelFailedError) {
        throw error;
      }
      if (abortController.signal.aborted) {
        throw new CommandLabelFailedError(
          `Labeler failed: timed out after ${String(this.options.timeoutMilliseconds)} ms`,
        );
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new CommandLabelFailedError(`Labeler failed: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
