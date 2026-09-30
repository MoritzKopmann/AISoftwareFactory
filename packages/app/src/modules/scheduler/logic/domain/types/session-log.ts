export type SessionLog =
  | {
      readonly kind: 'found';
      readonly entries: ReadonlyArray<{ readonly summary: string }>;
      readonly total: number;
    }
  | { readonly kind: 'no-session' }
  | { readonly kind: 'transcript-not-found' };
