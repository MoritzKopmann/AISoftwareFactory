// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import '../../../../assets/kit/kit.js';

describe('AisfActorElement', () => {
  it('should be registered and observe name when the kit loads', () => {
    const elementClass = customElements.get('aisf-actor') as unknown as {
      observedAttributes: string[];
    };

    expect(elementClass.observedAttributes).toEqual(['name']);
  });
});
