import type { RunContext } from './run-context.js';
import type { RunEnding } from './run-ending.js';
import type { ToolInputShape } from './tool-input-shape.js';

export type RunToolResult = {
  readonly text: string;
  readonly ending?: RunEnding;
};

export type RunTool = {
  readonly name: string;
  readonly description: string;
  readonly inputShape: ToolInputShape;
  readonly execute: (input: unknown, runContext: RunContext) => Promise<RunToolResult>;
};
