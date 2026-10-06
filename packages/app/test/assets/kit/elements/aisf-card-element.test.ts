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
});
