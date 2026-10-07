import type { PermissionVerdict } from './permission-verdict.js';
import type { SessionTool } from './session-tool.js';
import type { ToolCall } from './tool-call.js';

export type SessionSpec = {
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly prompt: string;
  readonly model: string;
  readonly tools: ReadonlyArray<SessionTool>;
  readonly decidePermission: (toolCall: ToolCall) => Promise<PermissionVerdict>;
};
