// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $$, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfTreeNodeElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should show a row per node with only its attributes when nodes are nested', async () => {
    await mount(
      '<aisf-tree-node round="1" question="Q" resolution="R" assumes="A"><aisf-tree-node question="Child" rejected fact="F"></aisf-tree-node></aisf-tree-node>',
    );

    const [outer, inner] = $$('aisf-tree-node');
    expect(outer?.querySelector(':scope > .aisf-tree-row .aisf-tree-round')?.textContent).toBe(
      'R1',
    );
    expect(outer?.querySelector(':scope > .aisf-tree-row .aisf-tree-assumes')?.textContent).toBe(
      'assumes: A',
    );
    expect(inner?.querySelector('.aisf-tree-fact')?.textContent).toBe('fact: F');
    expect(inner?.querySelector('.aisf-tree-round')).toBeNull();
    expect(inner?.hasAttribute('rejected')).toBe(true);
    expect($$('.aisf-tree-row')).toHaveLength(2);
  });
});
