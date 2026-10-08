import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEvent } from '../../logic/domain/types/session-event.js';
import type { ResumeSessionSpec } from '../../logic/domain/types/resume-session-spec.js';
import type { SessionSpec } from '../../logic/domain/types/session-spec.js';
import type { AgentSessions } from '../../logic/ports/agent-sessions.js';
import { createPermissionHooks } from './create-permission-hooks.js';
import { mapSdkMessage } from './map-sdk-message.js';

const appToolServerName = 'aisf';

type ToolInputSchema = Parameters<typeof tool>[2];

export type ClaudeAgentSdkSessionsOptions = {
  readonly claudeExecutablePath: string;
  readonly pluginDirectory: string;
  readonly now: () => string;
  readonly answerTimeoutMilliseconds: number;
};

export class ClaudeAgentSdkSessions implements AgentSessions {
  private readonly abortControllersBySessionId = new Map<string, AbortController>();

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

  stop(sessionId: string): void {
    this.abortControllersBySessionId.get(sessionId)?.abort();
  }

  stopAll(): void {
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

    try {
      const sdkQuery = query({
        prompt: spec.prompt,
        options: {
          cwd: spec.worktreePath,
          ...(sessionMode === 'resume'
            ? { resume: spec.sessionId }
            : { sessionId: spec.sessionId }),
          model: spec.model,
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
                  // Tool definitions build their shape with zod; logic keeps it opaque.
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
          abortController,
        },
      });

      for await (const message of sdkQuery) {
        for (const event of mapSdkMessage(message, this.options.now())) {
          yield event;
          if (event.kind === 'crashed' || event.kind === 'usage-limit') {
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
      this.abortControllersBySessionId.delete(spec.sessionId);
    }
  }
}
