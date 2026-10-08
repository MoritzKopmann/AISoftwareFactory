import type { ToolCall } from './tool-call.js';

export type PermissionRequest = ToolCall & { readonly reason?: string };
