export type RunEnding =
  | {
      readonly kind: 'escalated';
      readonly escalation: 'red' | 'spec' | 'denied';
      readonly reason: string;
    }
  | {
      readonly kind: 'permission-needed';
      readonly toolName: string;
      readonly toolInput: Readonly<Record<string, unknown>>;
    }
  | { readonly kind: 'parked'; readonly blockerNumber: number }
  | { readonly kind: 'finished' }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'crashed'; readonly reason: string }
  | { readonly kind: 'usage-limit'; readonly reason: string }
  | { readonly kind: 'app-restarted' }
  | { readonly kind: 'checkpoint'; readonly request: string };
