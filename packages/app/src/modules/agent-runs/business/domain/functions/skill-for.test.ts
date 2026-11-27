import { describe, expect, it } from 'vitest';
import { skillFor } from './skill-for.js';

describe('skillFor', () => {
  it.each([
    ['plan', ['ui'], 'aisf:ui-ticket'],
    ['implement', ['ui'], 'aisf:ui-implement-ticket'],
    ['plan', ['enhancement'], 'aisf:plan-ticket'],
    ['implement', [], 'aisf:implement-ticket'],
    ['plan', ['skill'], 'aisf:skill-ticket'],
    ['implement', ['skill'], 'aisf:skill-implement-ticket'],
    ['create', ['skill'], 'aisf:create-ticket'],
    ['design', ['ui'], 'aisf:design'],
    ['spike', ['ui', 'spike'], 'aisf:spike'],
    ['create', ['bug'], 'aisf:create-bug-ticket'],
    ['implement', ['bug'], 'aisf:implement-bug-ticket'],
    ['create', ['bug', 'ui'], 'aisf:create-bug-ticket'],
    ['implement', ['bug', 'ui'], 'aisf:implement-bug-ticket'],
    ['implement', ['bug', 'skill'], 'aisf:implement-bug-ticket'],
    ['create', ['bug', 'skill'], 'aisf:create-bug-ticket'],
    ['implement', ['bug', 'spike'], 'aisf:implement-bug-ticket'],
    ['implement', ['bug', 'onboard'], 'aisf:implement-bug-ticket'],
    ['create', ['ui'], 'aisf:create-ticket'],
  ] as const)('should pick the skill for stage %s and types %j', (stage, types, skill) => {
    expect(skillFor(stage, types)).toBe(skill);
  });
});
