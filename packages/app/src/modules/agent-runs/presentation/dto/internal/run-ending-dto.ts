export type RunEndingDto =
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

export type RunWaitDto = Extract<RunEndingDto, { kind: 'checkpoint' | 'permission-needed' }>;
