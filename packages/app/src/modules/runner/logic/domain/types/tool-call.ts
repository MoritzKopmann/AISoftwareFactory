export type ToolCall = {
  readonly toolName: string;
  readonly toolInput: Readonly<Record<string, unknown>>;
};
