import { describe, expect, it } from 'vitest';
import type { KnownBugsDescription } from './describe-known-bugs.js';
import { describeKnownBugsTrigger, hasKnownBugsTrigger } from './describe-known-bugs-trigger.js';

function listOf(countLabel: string): Extract<KnownBugsDescription, { readonly kind: 'list' }> {
  return { kind: 'list', countLabel, rows: [] };
}

describe('hasKnownBugsTrigger', () => {
  it('should be false when loading', () => {
    expect(hasKnownBugsTrigger({ kind: 'loading' })).toBe(false);
  });

  it('should be false when there are no findings', () => {
    expect(hasKnownBugsTrigger({ kind: 'empty' })).toBe(false);
  });

  it('should be true when the list holds findings', () => {
    expect(hasKnownBugsTrigger(listOf('1'))).toBe(true);
  });

  it('should be true when the read failed', () => {
    expect(hasKnownBugsTrigger({ kind: 'error', message: 'Could not load.', detail: '500' })).toBe(
      true,
    );
  });
});

describe('describeKnownBugsTrigger', () => {
  it('should label one finding in the singular when the list holds one', () => {
    expect(describeKnownBugsTrigger(listOf('1'))).toEqual({ label: '1 known bug' });
  });

  it('should label several findings in the plural when the list holds many', () => {
    expect(describeKnownBugsTrigger(listOf('3'))).toEqual({ label: '3 known bugs' });
  });

  it('should label plain "Known bugs" when the read failed', () => {
    expect(
      describeKnownBugsTrigger({ kind: 'error', message: 'Could not load.', detail: '500' }),
    ).toEqual({ label: 'Known bugs' });
  });
});
