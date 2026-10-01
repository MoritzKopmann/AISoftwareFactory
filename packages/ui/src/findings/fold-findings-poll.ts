import type { FindingResponse } from '@aisf/app/api-schemas/findings-schemas.js';
import type { FindingsOutcome } from './fetch-findings.js';

export type FindingsFailure = Exclude<FindingsOutcome, { readonly kind: 'answer' }>;

export type FindingsPoll = {
  readonly findings?: ReadonlyArray<FindingResponse>;
  readonly answeredAt?: string;
  readonly failure?: FindingsFailure;
};

export const initialFindingsPoll: FindingsPoll = {};

export function foldFindingsPoll(
  poll: FindingsPoll,
  outcome: FindingsOutcome,
  now: string,
): FindingsPoll {
  if (outcome.kind !== 'answer') {
    return { ...poll, failure: outcome };
  }
  return { findings: outcome.findings, answeredAt: now };
}
