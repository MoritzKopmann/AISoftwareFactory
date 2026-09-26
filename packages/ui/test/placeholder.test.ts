import { describe, expect, it } from 'vitest';

describe('ui', () => {
  it('runs the test toolchain', () => {
    expect([1, 2, 3]).toHaveLength(3);
  });
});
