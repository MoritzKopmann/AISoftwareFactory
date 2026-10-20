// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, click, mount, startPage } from '../fakes/fake-aisf.js';

const question = `<aisf-question name="q" heading="H">
  <aisf-card value="a">A</aisf-card>
  <aisf-more>detail</aisf-more>
</aisf-question>`;

describe('AisfMoreElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should hide the detail until opened when connected', async () => {
    await mount(question);

    expect($('.aisf-more-body').hidden).toBe(true);
    expect($('.aisf-more-toggle').textContent).toBe('More');
    expect($('.aisf-more-toggle').getAttribute('aria-expanded')).toBe('false');
    expect($('.aisf-more-body').textContent).toBe('detail');
  });

  it('should show the detail when the human opens More', async () => {
    await mount(question);

    await click($('.aisf-more-toggle'));

    expect($('.aisf-more-body').hidden).toBe(false);
    expect($('.aisf-more-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('should hide the detail again when the human closes More', async () => {
    await mount(question);
    await click($('.aisf-more-toggle'));

    await click($('.aisf-more-toggle'));

    expect($('.aisf-more-body').hidden).toBe(true);
  });
});
