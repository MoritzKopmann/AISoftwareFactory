import type { PermissionRequest } from './permission-request.js';
import type { PermissionVerdict } from './permission-verdict.js';
import type { SessionTool } from './session-tool.js';

export type SessionSpec = {
  readonly sessionId: string;
  readonly worktreePath: string;
  readonly prompt: string;
  readonly model: string;
  readonly tools: ReadonlyArray<SessionTool>;
  readonly decidePermission: (request: PermissionRequest) => Promise<PermissionVerdict>;
};
