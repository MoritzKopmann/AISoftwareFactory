// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

// A page's markup is parsed before the kit's module runs.
document.body.innerHTML =
  '<aisf-question name="q"><aisf-card value="x">X</aisf-card></aisf-question>';
const { registry } = await import('../../../assets/kit/kit.js');

const documented: Record<string, string[]> = {
  'aisf-round': ['number'],
  'aisf-question': ['name', 'heading', 'assumes'],
  'aisf-card': ['value', 'suggested', 'why'],
  'aisf-context': ['kind', 'path', 'line'],
  'aisf-confirm': [],
  'aisf-meta': ['label'],
  'aisf-figure': ['caption'],
  'aisf-tree-node': ['round', 'question', 'resolution', 'rejected', 'assumes', 'fact'],
  'aisf-task': ['number', 'heading', 'blocked-by', 'files', 'risk', 'hitl'],
};

describe('kit', () => {
  it('should map every documented tag to a class with exactly its attributes when imported', () => {
    expect(Object.keys(registry).sort()).toEqual(Object.keys(documented).sort());
    for (const [tag, attributes] of Object.entries(documented)) {
      const elementClass = registry[tag as keyof typeof registry] as unknown as {
        observedAttributes: string[];
      };
      expect([...elementClass.observedAttributes].sort()).toEqual([...attributes].sort());
      expect(customElements.get(tag)).toBe(elementClass);
    }
  });

  it("should keep the cards in a question's choices when the markup is parsed before the kit loads", () => {
    expect(document.querySelector('aisf-question .aisf-choices aisf-card')).not.toBeNull();
  });
});
