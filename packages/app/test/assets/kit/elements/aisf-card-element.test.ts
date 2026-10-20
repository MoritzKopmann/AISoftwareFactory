// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfCardElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should add the Suggested tag and the why line when the card is suggested with a reason', async () => {
    await mount(
      '<aisf-card value="a" suggested why="Cheapest">Label<div id="m">mockup</div></aisf-card>',
    );

    expect($('.aisf-suggested-tag').textContent).toBe('Suggested');
    expect($('.aisf-card-why').textContent).toBe('Cheapest');
    expect($('#m').textContent).toBe('mockup');
    expect($('.aisf-card-radio')).toBeTruthy();
  });

  it('should drop the tag and why when the attributes go away', async () => {
    await mount('<aisf-card value="a" suggested why="x">Label</aisf-card>');

    $('aisf-card').removeAttribute('suggested');
    $('aisf-card').removeAttribute('why');

    expect(document.querySelector('.aisf-suggested-tag')).toBeNull();
    expect(document.querySelector('.aisf-card-why')).toBeNull();
  });

  it('should show gain and cost parts and keep the label when the card has both', async () => {
    await mount('<aisf-card value="a" gain="fast" cost="more code">A</aisf-card>');

    expect($('.aisf-card-gain').textContent).toBe('fast');
    expect($('.aisf-card-cost').textContent).toBe('more code');
    expect($<HTMLElement & { label: string }>('aisf-card').label).toBe('A');
  });

  it('should show neither gain nor cost when the card has neither', async () => {
    await mount('<aisf-card value="a">A</aisf-card>');

    expect(document.querySelector('.aisf-card-gain')).toBeNull();
    expect(document.querySelector('.aisf-card-cost')).toBeNull();
  });
});
