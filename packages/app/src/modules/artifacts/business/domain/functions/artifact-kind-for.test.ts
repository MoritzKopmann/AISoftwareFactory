import { describe, expect, it } from 'vitest';
import { artifactKindFor } from './artifact-kind-for.js';

describe('artifactKindFor', () => {
  it('should return board when the id is design', () => {
    expect(artifactKindFor('design')).toBe('board');
  });

  it('should return page when the id is anything else', () => {
    expect(artifactKindFor('plan')).toBe('page');
    expect(artifactKindFor('designs')).toBe('page');
  });
});
