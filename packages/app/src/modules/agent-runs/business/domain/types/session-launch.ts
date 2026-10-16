import type { ToolCall } from './tool-call.js';

export type SessionLaunch =
  | { readonly kind: 'start'; readonly prompt: string }
  | { readonly kind: 'resume'; readonly prompt: string; readonly allowedCall?: ToolCall };
