export type AgentToolContext = {
  readonly runId: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly worktreePath: string;
};

export type AgentToolEnding =
  | {
      readonly kind: 'escalated';
      readonly escalation: 'red' | 'spec' | 'denied';
      readonly reason: string;
    }
  | {
      readonly kind: 'permission-needed';
      readonly toolName: string;
      readonly toolInput: Readonly<Record<string, unknown>>;
      readonly reason?: string;
    }
  | { readonly kind: 'parked'; readonly blockerNumber: number }
  | {
      readonly kind: 'checkpoint';
      readonly request: string;
      readonly artifactId?: string;
      readonly page?: { readonly title: string; readonly url: string };
    }
  | { readonly kind: 'finished' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'crashed'; readonly reason: string }
  | { readonly kind: 'usage-limit'; readonly reason: string }
  | { readonly kind: 'app-restarted' };

export type AgentToolWait = Extract<AgentToolEnding, { kind: 'checkpoint' | 'permission-needed' }>;

export type AgentToolResult =
  | {
      readonly text: string;
      readonly ending?: AgentToolEnding;
    }
  | { readonly wait: AgentToolWait };

export type AgentTool = {
  readonly name: string;
  readonly description: string;
  readonly inputShape: Readonly<Record<string, unknown>>;
  readonly execute: (input: unknown, context: AgentToolContext) => Promise<AgentToolResult>;
};

export interface AgentToolRegistry {
  register(tool: AgentTool): void;
  list(): ReadonlyArray<AgentTool>;
}
