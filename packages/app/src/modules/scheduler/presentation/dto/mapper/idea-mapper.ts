import type { IdeaResponse, IdeaRunNotStartedResponse } from '../api/ideas-schemas.js';

export function toIdeaResponse(ticketNumber: number): IdeaResponse {
  return { ticketNumber };
}

export function toIdeaRunNotStartedResponse(error: {
  readonly message: string;
  readonly ticketNumber: number;
}): IdeaRunNotStartedResponse {
  return { message: error.message, ticketNumber: error.ticketNumber };
}
