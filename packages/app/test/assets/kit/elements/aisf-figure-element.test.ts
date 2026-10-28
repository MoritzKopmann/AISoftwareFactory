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

  describe('inside a question', () => {
    it('should place the caption before a framed content box when the figure is in a question', async () => {
      await mount(
        '<aisf-question name="q" heading="H"><aisf-figure caption="How it behaves"><p>content</p></aisf-figure></aisf-question>',
      );

      const children = [...$('aisf-figure').children];
      expect(children.map((child) => child.className)).toEqual([
        'aisf-figure-caption',
        'aisf-figure-frame',
      ]);
      expect($('aisf-figure .aisf-figure-frame > p').textContent).toBe('content');
    });

    it('should show only the framed box when the figure in a question has no caption', async () => {
      await mount(
        '<aisf-question name="q" heading="H"><aisf-figure><p>content</p></aisf-figure></aisf-question>',
      );

      expect([...$('aisf-figure').children].map((child) => child.className)).toEqual([
        'aisf-figure-frame',
      ]);
    });

    it('should keep one frame and replace the caption when the caption changes', async () => {
      await mount(
        '<aisf-question name="q" heading="H"><aisf-figure caption="One"><p>content</p></aisf-figure></aisf-question>',
      );

      $('aisf-figure').setAttribute('caption', 'Two');

      expect($('.aisf-figure-caption').textContent).toBe('Two');
      expect(document.querySelectorAll('.aisf-figure-frame')).toHaveLength(1);
      expect($('aisf-figure').firstElementChild?.className).toBe('aisf-figure-caption');
    });

    it('should not frame the content when the figure is outside a question', async () => {
      await mount('<aisf-figure caption="One"><p>content</p></aisf-figure>');

      expect(document.querySelector('.aisf-figure-frame')).toBeNull();
    });
  });
});
