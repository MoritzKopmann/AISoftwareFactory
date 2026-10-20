import type { TicketStatusDto, TicketTypeDto } from './ticket-dto.js';

export type IdeaDto = {
  readonly title: string;
  readonly body: string;
  readonly status?: TicketStatusDto;
  readonly types?: ReadonlyArray<TicketTypeDto>;
  readonly priority?: 'critical' | 'high' | 'medium' | 'low';
};
