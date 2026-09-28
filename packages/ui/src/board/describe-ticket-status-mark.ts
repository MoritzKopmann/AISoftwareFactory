import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type StatusMarkTone = 'neutral' | 'flow' | 'done' | 'warn' | 'danger';

export type StatusMark = {
  readonly shape: string;
  readonly tone: StatusMarkTone;
  readonly pulses: boolean;
};

export function describeTicketStatusMark(status: TicketStatusResponse): StatusMark {
  switch (status) {
    case 'idea':
    case 'backlog':
      return { shape: '○', tone: 'neutral', pulses: false };
    case 'plan':
    case 'planned':
    case 'ready':
    case 'in-review':
      return { shape: '●', tone: 'flow', pulses: false };
    case 'in-progress':
      return { shape: '●', tone: 'flow', pulses: true };
    case 'stuck':
      return { shape: '■', tone: 'danger', pulses: false };
    case 'conflict':
      return { shape: '▲', tone: 'warn', pulses: false };
    case 'closed':
      return { shape: '✓', tone: 'done', pulses: false };
  }
}
