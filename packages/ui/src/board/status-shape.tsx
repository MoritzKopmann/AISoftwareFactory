import type { TicketStatusResponse } from '@aisf/app/api-schemas/tickets-schemas.js';
import { describeTicketStatusMark } from './describe-ticket-status-mark.js';

export function StatusShape({ status }: { status: TicketStatusResponse }) {
  const mark = describeTicketStatusMark(status);
  return (
    <span className={`shape s-${mark.tone}${mark.pulses ? ' pulse' : ''}`} aria-hidden="true">
      {mark.shape}
    </span>
  );
}
