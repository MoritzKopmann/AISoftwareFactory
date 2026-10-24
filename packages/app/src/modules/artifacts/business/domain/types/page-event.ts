export type PageEvent = {
  readonly kind: 'submit' | 'confirm' | 'reopen' | 'design-feedback' | 'design-accepted';
  readonly round: number;
  readonly payload: unknown;
};

/** Payload of a `design-feedback` event. `x` and `y` are in board px. */
export type DesignFeedbackPayload = {
  readonly round: number;
  readonly comments: ReadonlyArray<{
    readonly n: number;
    readonly board: string;
    readonly theme: string;
    readonly x: number;
    readonly y: number;
    readonly text: string;
  }>;
  readonly message: string;
};

export type DesignAcceptedPayload = { readonly round: number };
