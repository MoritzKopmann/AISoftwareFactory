import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEvent } from '../../logic/domain/types/session-event.js';
import type { SessionSpec } from '../../logic/domain/types/session-spec.js';
import type { AgentSessions } from '../../logic/ports/agent-sessions.js';
import { mapSdkMessage } from './map-sdk-message.js';

const appToolServerName = 'aisf';

type ToolInputSchema = Parameters<typeof tool>[2];

export type ClaudeAgentSdkSessionsOptions = {
  readonly claudeExecutablePath: string;
  readonly pluginDirectory: string;
  readonly now: () => string;
};

type PermissionRequest = {
  readonly toolName: string;
  readonly toolInput: Readonly<Record<string, unknown>>;
};

export class ClaudeAgentSdkSessions implements AgentSessions {
  private readonly abortControllersBySessionId = new Map<string, AbortController>();

  constructor(private readonly options: ClaudeAgentSdkSessionsOptions) {}

  start(spec: SessionSpec): AsyncIterable<SessionEvent> {
    const abortController = new AbortController();
    this.abortControllersBySessionId.set(spec.sessionId, abortController);
    return this.stream(spec, abortController);
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
    spec: SessionSpec,
    abortController: AbortController,
  ): AsyncGenerator<SessionEvent> {
    let permissionRequest: PermissionRequest | undefined;
    let sawSuccessfulResult = false;

    try {
      const sdkQuery = query({
        prompt: spec.prompt,
        options: {
          cwd: spec.worktreePath,
          sessionId: spec.sessionId,
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
          canUseTool: async (toolName, toolInput) => {
            permissionRequest ??= { toolName, toolInput };
            return {
              behavior: 'deny',
              message: 'A human has to decide on this tool call.',
              interrupt: true,
            };
          },
          abortController,
        },
      });

      for await (const message of sdkQuery) {
        if (permissionRequest !== undefined) {
          yield { kind: 'permission-needed', ...permissionRequest };
          return;
        }
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

      if (permissionRequest !== undefined) {
        yield { kind: 'permission-needed', ...permissionRequest };
        return;
      }
      yield sawSuccessfulResult
        ? { kind: 'completed' }
        : { kind: 'crashed', reason: 'The session ended without a successful result' };
    } catch (error) {
      if (permissionRequest !== undefined) {
        yield { kind: 'permission-needed', ...permissionRequest };
      } else if (!abortController.signal.aborted) {
        yield { kind: 'crashed', reason: error instanceof Error ? error.message : String(error) };
      }
    } finally {
      this.abortControllersBySessionId.delete(spec.sessionId);
    }
  }
}
