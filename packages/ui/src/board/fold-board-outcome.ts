import type { ProjectBoardResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type BoardOutcome =
  | { readonly kind: 'answer'; readonly response: ProjectBoardResponse }
  | { readonly kind: 'not-watched' }
  | { readonly kind: 'request-failed' };

export type BoardState = {
  readonly response: ProjectBoardResponse | undefined;
  readonly connection: 'ok' | 'not-watched' | 'request-failed';
};

export const initialBoardState: BoardState = { response: undefined, connection: 'ok' };

export function foldBoardOutcome(state: BoardState, outcome: BoardOutcome): BoardState {
  switch (outcome.kind) {
    case 'answer':
      return { response: outcome.response, connection: 'ok' };
    case 'not-watched':
      return { response: undefined, connection: 'not-watched' };
    case 'request-failed':
      return { response: state.response, connection: 'request-failed' };
  }
}
