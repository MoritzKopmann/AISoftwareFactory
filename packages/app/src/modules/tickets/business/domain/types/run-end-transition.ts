export type RunEndTransition =
  | { readonly kind: 'none' }
  | { readonly kind: 'return-to-ready' }
  | {
      readonly kind: 'flag';
      readonly state: 'waiting' | 'stuck';
      readonly comment: string;
    };
