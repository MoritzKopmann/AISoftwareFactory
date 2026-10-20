// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import '../../../../assets/kit/kit.js';

describe('AisfUnitElement', () => {
  it('should be registered and observe module, layer and mark when the kit loads', () => {
    const elementClass = customElements.get('aisf-unit') as unknown as {
      observedAttributes: string[];
    };

    expect([...elementClass.observedAttributes].sort()).toEqual(['layer', 'mark', 'module']);
  });
});
