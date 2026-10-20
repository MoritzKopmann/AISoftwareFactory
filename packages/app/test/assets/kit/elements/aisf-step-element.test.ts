// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import '../../../../assets/kit/kit.js';

describe('AisfStepElement', () => {
  it('should be registered and observe from, to and mark when the kit loads', () => {
    const elementClass = customElements.get('aisf-step') as unknown as {
      observedAttributes: string[];
    };

    expect([...elementClass.observedAttributes].sort()).toEqual(['from', 'mark', 'to']);
  });
});
