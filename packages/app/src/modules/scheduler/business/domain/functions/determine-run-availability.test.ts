import { describe, expect, it } from 'vitest';
import { determineRunAvailability } from './determine-run-availability.js';
import type { RunAvailabilityInput } from '../types/run-availability-input.js';
import type { SchedulableTicket } from '../types/schedulable-ticket.js';

const readyLeaf: SchedulableTicket = {
  number: 42,
  title: 'Add login',
  status: 'ready',
  types: [],
  isLeaf: true,
  hasOpenBlocker: false,
  subIssueNumbers: [],
  snapshotTakenAt: '2026-09-29T10:00:00.000Z',
};

function buildInput(overrides: Partial<RunAvailabilityInput> = {}): RunAvailabilityInput {
  return {
    ticket: readyLeaf,
    subIssues: [],
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
      subIssues: [],
      ticketIsRunning: false,
      runsBlocked: { blocked: false },
      projectOnboarded: true,
    };

    expect(determineRunAvailability(input)).toEqual({ kind: 'absent' });
  });

  it.each<[string, Partial<SchedulableTicket>]>([
    ['is a ui ticket and not a spike', { types: ['ui'] }],
    ['has an open blocker', { hasOpenBlocker: true }],
    ['is not a leaf', { isLeaf: false }],
    ['is in-progress', { status: 'in-progress' }],
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

  it('should be disabled naming the running ticket when a hitl leaf has a run active', () => {
    const input = buildInput({ ticket: { ...readyLeaf, number: 7 }, ticketIsRunning: true });

    expect(determineRunAvailability(input)).toEqual({ kind: 'disabled', reason: '#7 is running' });
  });

  it('should be absent rather than disabled when an ineligible ticket has a run active', () => {
    const input = buildInput({
      ticket: { ...readyLeaf, hasOpenBlocker: true },
      ticketIsRunning: true,
    });

    expect(determineRunAvailability(input)).toEqual({ kind: 'absent' });
  });

  it.each<[string, Partial<SchedulableTicket>]>([
    ['an idea', { status: 'idea' }],
    ['a plan ticket', { status: 'plan' }],
    ['a plan ticket with sub-issues', { status: 'plan', isLeaf: false }],
    ['a ui idea', { status: 'idea', types: ['ui'] }],
  ])('should be available when the ticket is %s', (_description, ticketOverrides) => {
    const ticket = { ...readyLeaf, ...ticketOverrides };

    expect(determineRunAvailability(buildInput({ ticket }))).toEqual({ kind: 'available' });
  });

  it.each<[string, Partial<SchedulableTicket>]>([
    ['an idea', { status: 'idea', hasOpenBlocker: true }],
    ['a plan ticket', { status: 'plan', hasOpenBlocker: true }],
  ])('should be absent when %s has an open blocker', (_description, ticketOverrides) => {
    const ticket = { ...readyLeaf, ...ticketOverrides };

    expect(determineRunAvailability(buildInput({ ticket }))).toEqual({ kind: 'absent' });
  });

  it('should be disabled naming the spike when a plan ticket has an open spike sub-issue', () => {
    const ticket: SchedulableTicket = {
      ...readyLeaf,
      number: 7,
      status: 'plan',
      isLeaf: false,
      subIssueNumbers: [8, 9],
    };
    const subIssues: ReadonlyArray<SchedulableTicket> = [
      { ...readyLeaf, number: 8, status: 'closed', types: ['spike'] },
      { ...readyLeaf, number: 9, types: ['spike'] },
    ];

    expect(determineRunAvailability(buildInput({ ticket, subIssues }))).toEqual({
      kind: 'disabled',
      reason: 'Waiting for spike #9',
    });
  });

  it('should be available when a plan ticket has no open spike sub-issue', () => {
    const ticket: SchedulableTicket = {
      ...readyLeaf,
      number: 7,
      status: 'plan',
      isLeaf: false,
      subIssueNumbers: [8, 9],
    };
    const subIssues: ReadonlyArray<SchedulableTicket> = [
      { ...readyLeaf, number: 8, status: 'closed', types: ['spike'] },
      { ...readyLeaf, number: 9, types: ['task'] },
    ];

    expect(determineRunAvailability(buildInput({ ticket, subIssues }))).toEqual({
      kind: 'available',
    });
  });
});
