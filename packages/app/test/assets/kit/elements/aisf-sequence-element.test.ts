// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, $$, mount, startPage } from '../fakes/fake-aisf.js';

const SEQUENCE =
  '<aisf-sequence><aisf-actor name="scheduler"></aisf-actor><aisf-actor name="runner"></aisf-actor><aisf-step from="scheduler" to="runner" mark="new">start(run)</aisf-step></aisf-sequence>';

describe('AisfSequenceElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should draw two actor columns and one marked edge when the sequence has two actors and a step', async () => {
    await mount(SEQUENCE);

    const svg = $<SVGElement>('aisf-sequence svg[role="img"]');
    const names = $$('.aisf-actor-box .aisf-label', svg).map((label) => label.textContent);
    const edges = $$('.aisf-edge', svg);
    const link = $<SVGElement>('.aisf-link', svg);
    expect(names).toEqual(['scheduler', 'runner']);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.getAttribute('class')).toContain('aisf-edge-new');
    expect(link.dataset['from']).toBe('scheduler');
    expect(link.dataset['to']).toBe('runner');
    expect(link.querySelector('.aisf-label')?.textContent).toBe('start(run)');
  });

  it('should give the svg a viewBox, a title and text of at least 12 units when drawn', async () => {
    await mount(SEQUENCE);

    const svg = $<SVGElement>('aisf-sequence svg');
    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    expect(svg.querySelector('title')?.textContent).not.toBe('');
    for (const label of $$('text', svg)) {
      expect(parseFloat(label.style.fontSize)).toBeGreaterThanOrEqual(12);
    }
  });

  it('should add the unknown actor as the last flagged column when a step names an unlisted actor', async () => {
    await mount(
      '<aisf-sequence><aisf-actor name="scheduler"></aisf-actor><aisf-step from="scheduler" to="runer">go</aisf-step></aisf-sequence>',
    );

    const boxes = $$('.aisf-actor-box');
    expect(boxes.map((box) => box.querySelector('.aisf-label')?.textContent)).toEqual([
      'scheduler',
      'runer',
    ]);
    expect(boxes[0]?.querySelector('.aisf-shape-flagged')).toBeNull();
    expect(boxes[1]?.querySelector('.aisf-shape-flagged')).not.toBeNull();
  });

  it('should draw a loop when a step starts and ends at the same actor', async () => {
    await mount(
      '<aisf-sequence><aisf-actor name="a"></aisf-actor><aisf-step from="a" to="a">retry</aisf-step></aisf-sequence>',
    );

    expect($$('.aisf-link .aisf-edge')).toHaveLength(1);
  });

  it('should draw again when a step attribute changes', async () => {
    await mount(SEQUENCE);

    $('aisf-step').setAttribute('mark', 'changed');

    expect($('.aisf-edge').getAttribute('class')).toContain('aisf-edge-changed');
    expect($$('aisf-sequence svg')).toHaveLength(1);
  });

  it('should draw no step when the sequence is empty', async () => {
    await mount('<aisf-sequence></aisf-sequence>');

    expect($$('aisf-sequence svg[role="img"]')).toHaveLength(1);
    expect($$('.aisf-edge')).toHaveLength(0);
  });
});
