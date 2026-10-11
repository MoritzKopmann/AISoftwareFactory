import { describeTicketStatusMark, type StatusMarkKey } from './describe-ticket-status-mark.js';

export function StatusShape({ status }: { status: StatusMarkKey }) {
  const mark = describeTicketStatusMark(status);
  return (
    <span className={`shape s-${mark.tone}${mark.pulses ? ' pulse' : ''}`} aria-hidden="true">
      {mark.shape}
    </span>
  );
}
