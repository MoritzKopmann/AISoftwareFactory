import type { TicketType } from './ticket-type.js';

const typeLabelPrefix = 'type: ';

const ticketTypes: ReadonlyArray<TicketType> = ['bug', 'enhancement', 'task', 'spike', 'ui'];

export function deriveTicketTypes(labelNames: ReadonlyArray<string>): ReadonlyArray<TicketType> {
  const types = labelNames
    .filter((labelName) => labelName.startsWith(typeLabelPrefix))
    .map((labelName) => labelName.slice(typeLabelPrefix.length))
    .filter((value): value is TicketType => ticketTypes.some((type) => type === value));
  return [...new Set(types)];
}
