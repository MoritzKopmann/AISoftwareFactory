import { describe, expect, it } from 'vitest';
import { determineRunAvailability } from '../../../../../../src/modules/scheduler/logic/domain/functions/determine-run-availability.js';
import type { RunAvailabilityInput } from '../../../../../../src/modules/scheduler/logic/domain/types/run-availability-input.js';
import type { SchedulableTicket } from '../../../../../../src/modules/scheduler/logic/domain/types/schedulable-ticket.js';

const readyLeaf: SchedulableTicket = {
  number: 42,
  status: 'ready',
  hitl: false,
  types: [],
  isLeaf: true,
  hasOpenBlocker: false,
  snapshotTakenAt: '2026-09-29T10:00:00.000Z',
};

function buildInput(overrides: Partial<RunAvailabilityInput> = {}): RunAvailabilityInput {
  return {
    ticket: readyLeaf,
    ticketIsRunning: false,
    runsBlocked: { blocked: false },
    projectOnboarded: true,
    ...overrides,
  };
}

describe('determineRunAvailability', () => {
  it('should be available when the ticket is an unblocked ready leaf and nothing prevents a run', () => {
    expect(determineRunAvailability(buildInput())).toEqual({ kind: 'available' });
  });

  it('should be absent when the ticket is unknown', () => {
    const input: RunAvailabilityInput = {
      ticketIsRunning: false,
      runsBlocked: { blocked: false },
      projectOnboarded: true,
    };

    expect(determineRunAvailability(input)).toEqual({ kind: 'absent' });
  });

  it.each<[string, Partial<SchedulableTicket>]>([
    ['is hitl', { hitl: true }],
    ['is a ui ticket and not a spike', { types: ['ui'] }],
    ['has an open blocker', { hasOpenBlocker: true }],
    ['is not a leaf', { isLeaf: false }],
    ['is in-progress', { status: 'in-progress' }],
    ['is stuck', { status: 'stuck' }],
    ['is planned', { status: 'planned' }],
  ])('should be absent when the ticket %s', (_description, ticketOverrides) => {
    const ticket = { ...readyLeaf, ...ticketOverrides };

    expect(determineRunAvailability(buildInput({ ticket }))).toEqual({ kind: 'absent' });
  });

  it('should be available when the ticket is labelled both ui and spike', () => {
    const ticket: SchedulableTicket = { ...readyLeaf, types: ['ui', 'spike'] };

    expect(determineRunAvailability(buildInput({ ticket }))).toEqual({ kind: 'available' });
  });

  it('should be disabled naming the ticket when it already has a run active', () => {
    const input = buildInput({ ticketIsRunning: true });

    expect(determineRunAvailability(input)).toEqual({
      kind: 'disabled',
      reason: '#42 is running',
    });
  });

  it('should be disabled with the reason when runs are blocked', () => {
    const input = buildInput({
      runsBlocked: { blocked: true, reason: 'ANTHROPIC_API_KEY is set' },
    });

    expect(determineRunAvailability(input)).toEqual({
      kind: 'disabled',
      reason: 'ANTHROPIC_API_KEY is set',
    });
  });

  it('should be disabled when the project is not onboarded', () => {
    expect(determineRunAvailability(buildInput({ projectOnboarded: false }))).toEqual({
      kind: 'disabled',
      reason: 'The project is not onboarded',
    });
  });

  it("should be disabled when the snapshot is older than the ticket's last run end", () => {
    const input = buildInput({ lastRunEndedAt: '2026-09-29T10:00:01.000Z' });

    expect(determineRunAvailability(input)).toEqual({
      kind: 'disabled',
      reason: 'Waiting for GitHub to catch up',
    });
  });

  it("should be available when the snapshot is at least as new as the ticket's last run end", () => {
    const input = buildInput({ lastRunEndedAt: '2026-09-29T10:00:00.000Z' });

    expect(determineRunAvailability(input)).toEqual({ kind: 'available' });
  });

  it('should be absent rather than disabled when an ineligible ticket has a run active', () => {
    const input = buildInput({
      ticket: { ...readyLeaf, hitl: true },
      ticketIsRunning: true,
    });

    expect(determineRunAvailability(input)).toEqual({ kind: 'absent' });
  });
});
