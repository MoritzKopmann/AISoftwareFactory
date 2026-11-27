import { describe, expect, it } from 'vitest';
import type { TicketStatus } from '../../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../../shared/ticket-type/ticket-type.js';
import { runStageFor } from './run-stage-for.js';

describe('runStageFor', () => {
  it('should return design when an idea ticket has the ui type', () => {
    expect(runStageFor({ status: 'idea', types: ['ui'] })).toBe('design');
  });

  it('should return create when an idea ticket has no type', () => {
    expect(runStageFor({ status: 'idea', types: [] })).toBe('create');
  });

  it('should return onboard when a ready ticket has the onboard type', () => {
    expect(runStageFor({ status: 'ready', types: ['onboard'] })).toBe('onboard');
  });

  it('should return create when an idea ticket has the onboard type', () => {
    expect(runStageFor({ status: 'idea', types: ['onboard'] })).toBe('create');
  });

  it('should return plan when a plan ticket has the onboard type', () => {
    expect(runStageFor({ status: 'plan', types: ['onboard'] })).toBe('plan');
  });

  it('should return spike when a ready ticket has the spike type', () => {
    expect(runStageFor({ status: 'ready', types: ['spike'] })).toBe('spike');
  });

  it('should return implement when a ready ticket has no special type', () => {
    expect(runStageFor({ status: 'ready', types: ['bug'] })).toBe('implement');
  });

  it.each<['create' | 'implement', TicketStatus]>([
    ['create', 'idea'],
    ['create', 'plan'],
    ['implement', 'ready'],
    ['implement', 'in-review'],
  ])('should return %s when a bug ticket is at %s', (stage, status) => {
    expect(runStageFor({ status, types: ['bug'] })).toBe(stage);
  });

  it.each<[ReadonlyArray<TicketType>, TicketStatus]>(
    (['idea', 'plan', 'ready'] as const).flatMap((status) =>
      (['ui', 'skill', 'spike', 'onboard'] as const).map(
        (otherType): [ReadonlyArray<TicketType>, TicketStatus] => [['bug', otherType], status],
      ),
    ),
  )('should return the bug stage when a ticket with types %j is at %s', (types, status) => {
    expect(runStageFor({ status, types })).toBe(runStageFor({ status, types: ['bug'] }));
  });

  it('should return plan when a skill ticket is at plan', () => {
    expect(runStageFor({ status: 'plan', types: ['skill'] })).toBe('plan');
  });
});
