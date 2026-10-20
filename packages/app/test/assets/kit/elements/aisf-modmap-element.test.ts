// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, $$, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfModmapElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should place the unit in its module column and layer row with its mark when drawn', async () => {
    await mount(
      '<aisf-modmap layers="presentation business"><aisf-unit module="runs" layer="business" mark="changed">RunService</aisf-unit></aisf-modmap>',
    );

    const unit = $<SVGElement>('aisf-modmap svg[role="img"] .aisf-unit-box');
    expect(unit.dataset['module']).toBe('runs');
    expect(unit.dataset['layer']).toBe('business');
    expect(unit.querySelector('.aisf-label')?.textContent).toBe('RunService');
    expect(unit.querySelector('.aisf-shape')?.getAttribute('class')).toContain(
      'aisf-shape-changed',
    );
    expect($$('.aisf-module-head').map((head) => head.textContent)).toEqual(['runs']);
    expect($$('.aisf-layer-head').map((head) => head.textContent)).toEqual([
      'presentation',
      'business',
    ]);
  });

  it('should order modules by first appearance when units come in mixed order', async () => {
    await mount(
      '<aisf-modmap layers="a"><aisf-unit module="m2" layer="a">X</aisf-unit><aisf-unit module="m1" layer="a">Y</aisf-unit><aisf-unit module="m2" layer="a">Z</aisf-unit></aisf-modmap>',
    );

    expect($$('.aisf-module-head').map((head) => head.textContent)).toEqual(['m2', 'm1']);
    expect($$('.aisf-unit-box')).toHaveLength(3);
  });

  it('should add an extra last flagged row when a unit names an unknown layer', async () => {
    await mount(
      '<aisf-modmap layers="business"><aisf-unit module="runs" layer="infra">Repo</aisf-unit></aisf-modmap>',
    );

    const heads = $$('.aisf-layer-head');
    const unit = $<SVGElement>('.aisf-unit-box');
    expect(heads.map((head) => head.textContent)).toEqual(['business', 'infra']);
    expect(heads[0]?.classList.contains('aisf-flagged')).toBe(false);
    expect(heads[1]?.classList.contains('aisf-flagged')).toBe(true);
    expect(unit.dataset['layer']).toBe('infra');
    expect(unit.querySelector('.aisf-shape-flagged')).not.toBeNull();
  });

  it('should give the svg a viewBox, a title and text of at least 12 units when drawn', async () => {
    await mount(
      '<aisf-modmap layers="a"><aisf-unit module="m" layer="a">X</aisf-unit></aisf-modmap>',
    );

    const svg = $<SVGElement>('aisf-modmap svg');
    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    expect(svg.querySelector('title')?.textContent).not.toBe('');
    for (const label of $$('text', svg)) {
      expect(parseFloat(label.style.fontSize)).toBeGreaterThanOrEqual(12);
    }
  });

  it('should draw again when the layers attribute changes', async () => {
    await mount(
      '<aisf-modmap layers="a"><aisf-unit module="m" layer="a">X</aisf-unit></aisf-modmap>',
    );

    $('aisf-modmap').setAttribute('layers', 'a b');

    expect($$('.aisf-layer-head')).toHaveLength(2);
    expect($$('aisf-modmap svg')).toHaveLength(1);
  });

  it('should draw again when a unit attribute changes', async () => {
    await mount(
      '<aisf-modmap layers="a b"><aisf-unit module="m" layer="a">X</aisf-unit></aisf-modmap>',
    );

    $('aisf-unit').setAttribute('layer', 'b');

    expect($<SVGElement>('.aisf-unit-box').dataset['layer']).toBe('b');
  });
});
