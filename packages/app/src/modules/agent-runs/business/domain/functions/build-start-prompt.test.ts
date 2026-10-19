import { describe, expect, it } from 'vitest';
import { buildStartPrompt } from './build-start-prompt.js';

const base = {
  stage: 'implement',
  status: 'in-review',
  ticketNumber: 7,
  latestRunEndedAt: '2026-10-18T09:00:00.000Z',
} as const;

describe('buildStartPrompt', () => {
  it('should add --since with the last run end when an implement run starts on an in-review ticket', () => {
    const prompt = buildStartPrompt(base);

    expect(prompt).toBe('/aisf:implement-ticket 7 --since 2026-10-18T09:00:00.000Z');
  });

  it('should leave out --since when the in-review ticket has no earlier run end', () => {
    const prompt = buildStartPrompt({ ...base, latestRunEndedAt: undefined });

    expect(prompt).toBe('/aisf:implement-ticket 7');
  });

  it('should leave out --since when the ticket is ready', () => {
    const prompt = buildStartPrompt({ ...base, status: 'ready' });

    expect(prompt).toBe('/aisf:implement-ticket 7');
  });

  it('should leave out --since when the stage is not implement', () => {
    const prompt = buildStartPrompt({ ...base, stage: 'plan', ticketNumber: 9 });

    expect(prompt).toBe('/aisf:plan-ticket 9');
  });
});
