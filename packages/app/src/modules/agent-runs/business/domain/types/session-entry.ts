export type SessionToolResultPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'image'; readonly mediaType: string; readonly data: string };

/** One content block of a run's session. `id` is `<SDK message uuid>#<content block index>`. */
export type SessionEntry =
  | { readonly kind: 'prompt'; readonly id: string; readonly text: string }
  | { readonly kind: 'text'; readonly id: string; readonly text: string }
  | {
      readonly kind: 'tool-call';
      readonly id: string;
      readonly toolUseId: string;
      readonly name: string;
      readonly input: unknown;
      readonly label?: string;
    }
  | {
      readonly kind: 'tool-result';
      readonly id: string;
      readonly toolUseId: string;
      readonly isError: boolean;
      readonly parts: ReadonlyArray<SessionToolResultPart>;
    };
