import type { SessionSpec } from './session-spec.js';
import type { ToolCall } from './tool-call.js';

export type ResumeSessionSpec = SessionSpec & {
  readonly allowedCall?: ToolCall;
};
