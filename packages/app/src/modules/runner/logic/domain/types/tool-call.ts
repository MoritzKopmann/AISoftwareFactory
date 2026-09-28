export type ToolCall = {
  readonly toolName: string;
  readonly input: Readonly<Record<string, unknown>>;
};
