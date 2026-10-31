import type { UUID } from 'node:crypto';
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEvent } from '../../business/domain/types/session-event.js';
import type { ResumeSessionSpec } from '../../business/domain/types/resume-session-spec.js';
import type { SessionSpec } from '../../business/domain/types/session-spec.js';
import type { AgentSessions } from '../../business/port/session/agent-sessions.js';
import { createPermissionHooks } from './create-permission-hooks.js';
import { SessionInput } from './session-input.js';
import { createStreamState, mapSdkMessage } from './map-sdk-message.js';

const appToolServerName = 'aisf';

type ToolInputSchema = Parameters<typeof tool>[2];

export type ClaudeAgentSdkSessionsOptions = {
  readonly claudeExecutablePath: string;
  readonly pluginDirectory: string;
  readonly answerTimeoutMilliseconds: number;
};

export class ClaudeAgentSdkSessions implements AgentSessions {
  private readonly abortControllersBySessionId = new Map<string, AbortController>();
  private readonly inputsBySessionId = new Map<string, SessionInput>();

  constructor(private readonly options: ClaudeAgentSdkSessionsOptions) {}

  start(spec: SessionSpec): AsyncIterable<SessionEvent> {
    const abortController = new AbortController();
    this.abortControllersBySessionId.set(spec.sessionId, abortController);
    return this.stream(spec, abortController, 'start');
  }

  resume(spec: ResumeSessionSpec): AsyncIterable<SessionEvent> {
    const abortController = new AbortController();
    this.abortControllersBySessionId.set(spec.sessionId, abortController);
    return this.stream(spec, abortController, 'resume');
  }

  send(sessionId: string, messageId: string, text: string): 'pushed' | 'closed' {
    return (
      this.inputsBySessionId.get(sessionId)?.push({
        type: 'user',
        uuid: messageId as UUID,
        message: { role: 'user', content: text },
        parent_tool_use_id: null,
        origin: { kind: 'human' },
      }) ?? 'closed'
    );
  }

  stop(sessionId: string): void {
    this.inputsBySessionId.get(sessionId)?.close();
    this.abortControllersBySessionId.get(sessionId)?.abort();
  }

  stopAll(): void {
    for (const input of this.inputsBySessionId.values()) {
      input.close();
    }
    for (const abortController of this.abortControllersBySessionId.values()) {
      abortController.abort();
    }
  }

  private async *stream(
    spec: ResumeSessionSpec,
    abortController: AbortController,
    sessionMode: 'start' | 'resume',
  ): AsyncGenerator<SessionEvent> {
    let sawSuccessfulResult = false;
    const streamState = createStreamState();
    const input = new SessionInput();
    this.inputsBySessionId.set(spec.sessionId, input);
    input.push({
      type: 'user',
      message: { role: 'user', content: spec.prompt },
      parent_tool_use_id: null,
    });

    yield { kind: 'generating', active: true };

    try {
      const sdkQuery = query({
        prompt: input,
        options: {
          cwd: spec.worktreePath,
          ...(sessionMode === 'resume'
            ? { resume: spec.sessionId }
            : { sessionId: spec.sessionId }),
          model: spec.model,
          // Without it, mid-turn and foreground handbacks never reach the live stream.
          extraArgs: { 'replay-user-messages': null },
          permissionMode: 'auto',
          settingSources: ['project'],
          plugins: [{ type: 'local', path: this.options.pluginDirectory }],
          pathToClaudeCodeExecutable: this.options.claudeExecutablePath,
          mcpServers: {
            [appToolServerName]: createSdkMcpServer({
              name: appToolServerName,
              version: '1.0.0',
              alwaysLoad: true,
              timeout: this.options.answerTimeoutMilliseconds,
              tools: spec.tools.map((sessionTool) =>
                tool(
                  sessionTool.name,
                  sessionTool.description,
                  // Tool definitions build their shape with zod; business keeps it opaque.
                  { ...sessionTool.inputShape } as ToolInputSchema,
                  async (input) => ({
                    content: [{ type: 'text', text: await sessionTool.execute(input) }],
                  }),
                ),
              ),
            }),
          },
          allowedTools: spec.tools.map(
            (sessionTool) => `mcp__${appToolServerName}__${sessionTool.name}`,
          ),
          hooks: createPermissionHooks(
            spec.decidePermission,
            this.options.answerTimeoutMilliseconds,
            spec.allowedCall,
          ),
          canUseTool: async (toolName, toolInput, options) => {
            const verdict = await spec.decidePermission({
              toolName,
              toolInput,
              ...(options.decisionReason === undefined ? {} : { reason: options.decisionReason }),
            });
            return verdict.kind === 'allow'
              ? { behavior: 'allow', updatedInput: toolInput }
              : { behavior: 'deny', message: verdict.message };
          },
          includePartialMessages: true,
          abortController,
        },
      });

      for await (const message of sdkQuery) {
        // Close before yielding: a send after this result must answer `closed`.
        if (message.type === 'result' && hasNoQueuedTurns(message)) {
          input.close();
        }
        for (const event of mapSdkMessage(message, streamState)) {
          yield event;
          if (
            event.kind === 'crashed' ||
            (event.kind === 'window-observed' && event.refusal !== null)
          ) {
            return;
          }
        }
        if (message.type === 'result') {
          sawSuccessfulResult = message.subtype === 'success' && !message.is_error;
        }
      }

      yield sawSuccessfulResult
        ? { kind: 'completed' }
        : { kind: 'crashed', reason: 'The session ended without a successful result' };
    } catch (error) {
      if (!abortController.signal.aborted) {
        yield { kind: 'crashed', reason: error instanceof Error ? error.message : String(error) };
      }
    } finally {
      input.close();
      this.inputsBySessionId.delete(spec.sessionId);
      this.abortControllersBySessionId.delete(spec.sessionId);
    }
  }
}

function hasNoQueuedTurns(result: { queued_turn_count?: number }): boolean {
  return (result.queued_turn_count ?? 0) === 0;
}
