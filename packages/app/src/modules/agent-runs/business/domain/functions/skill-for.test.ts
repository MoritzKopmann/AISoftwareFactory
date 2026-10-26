import { describe, expect, it } from 'vitest';
import { skillFor } from './skill-for.js';

describe('skillFor', () => {
  it.each([
    ['plan', ['ui'], 'aisf:ui-ticket'],
    ['implement', ['ui'], 'aisf:ui-implement-ticket'],
    ['plan', ['enhancement'], 'aisf:plan-ticket'],
    ['implement', [], 'aisf:implement-ticket'],
    ['design', ['ui'], 'aisf:design'],
    ['spike', ['ui', 'spike'], 'aisf:spike'],
  ] as const)('should pick the skill for stage %s and types %j', (stage, types, skill) => {
    expect(skillFor(stage, types)).toBe(skill);
  });
});
