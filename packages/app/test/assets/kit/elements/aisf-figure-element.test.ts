// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfFigureElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should add a caption and leave the content and its classes as written when the figure has a caption', async () => {
    await mount(
      '<aisf-figure caption="How it behaves"><div class="aisf-lane"><span class="aisf-node aisf-node-new">A</span></div></aisf-figure>',
    );

    expect($('aisf-figure .aisf-figure-caption').textContent).toBe('How it behaves');
    expect($('aisf-figure > .aisf-lane').outerHTML).toBe(
      '<div class="aisf-lane"><span class="aisf-node aisf-node-new">A</span></div>',
    );
  });

  it('should add no caption when the attribute is missing', async () => {
    await mount('<aisf-figure><svg></svg></aisf-figure>');

    expect(document.querySelector('.aisf-figure-caption')).toBeNull();
  });

  it('should replace the caption when the attribute changes', async () => {
    await mount('<aisf-figure caption="One"></aisf-figure>');

    $('aisf-figure').setAttribute('caption', 'Two');

    expect($('.aisf-figure-caption').textContent).toBe('Two');
    expect(document.querySelectorAll('.aisf-figure-caption')).toHaveLength(1);
  });
});
