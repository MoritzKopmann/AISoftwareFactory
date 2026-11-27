import type { TicketTypeResponse } from '@aisf/app/api-schemas/tickets-schemas.js';

export type ChipType = 'ui' | 'spike' | 'skill' | 'bug';

export type TypeChip = {
  readonly type: ChipType;
  readonly label: string;
};

const chipTypesInOrder: ReadonlyArray<ChipType> = ['ui', 'spike', 'skill', 'bug'];

export function describeTypeChips(
  types: ReadonlyArray<TicketTypeResponse>,
): ReadonlyArray<TypeChip> {
  return chipTypesInOrder
    .filter((type) => types.includes(type))
    .map((type) => ({ type, label: type.toUpperCase() }));
}
