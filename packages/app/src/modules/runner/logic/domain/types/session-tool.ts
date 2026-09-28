import type { ToolInputShape } from './tool-input-shape.js';

export type SessionTool = {
  readonly name: string;
  readonly description: string;
  readonly inputShape: ToolInputShape;
  readonly execute: (input: unknown) => Promise<string>;
};
