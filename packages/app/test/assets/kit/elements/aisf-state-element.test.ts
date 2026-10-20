// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, $$, mount, startPage } from '../fakes/fake-aisf.js';

const STATE =
  '<aisf-state><aisf-step from="ready" to="in-progress">claim</aisf-step><aisf-step from="in-progress" to="ready">reset</aisf-step></aisf-state>';

describe('AisfStateElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should show the states in order of first appearance and one labelled edge per step when drawn', async () => {
    await mount(STATE);

    const states = $$('aisf-state svg[role="img"] .aisf-state-box .aisf-label').map(
      (label) => label.textContent,
    );
    const labels = $$('aisf-state .aisf-link .aisf-label').map((label) => label.textContent);
    expect(states).toEqual(['ready', 'in-progress']);
    expect($$('aisf-state .aisf-edge')).toHaveLength(2);
    expect(labels).toEqual(['claim', 'reset']);
  });

  it('should carry the mark on the edge when a step is marked', async () => {
    await mount('<aisf-state><aisf-step from="a" to="b" mark="new">go</aisf-step></aisf-state>');

    expect($('.aisf-edge').getAttribute('class')).toContain('aisf-edge-new');
  });

  it('should draw a loop when a step starts and ends at the same state', async () => {
    await mount('<aisf-state><aisf-step from="a" to="a">again</aisf-step></aisf-state>');

    expect($$('.aisf-state-box')).toHaveLength(1);
    expect($$('.aisf-edge')).toHaveLength(1);
  });

  it('should give the svg a viewBox, a title and text of at least 12 units when drawn', async () => {
    await mount(STATE);

    const svg = $<SVGElement>('aisf-state svg');
    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    expect(svg.querySelector('title')?.textContent).not.toBe('');
    for (const label of $$('text', svg)) {
      expect(parseFloat(label.style.fontSize)).toBeGreaterThanOrEqual(12);
    }
  });

  it('should draw again when a step attribute changes', async () => {
    await mount(STATE);

    $('aisf-step').setAttribute('to', 'done');

    expect($$('.aisf-state-box')).toHaveLength(3);
  });
});
