// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, click, mount, startPage } from '../fakes/fake-aisf.js';

const question = `<aisf-question name="q" heading="H">
  <aisf-definitions><dl><dt>Term</dt><dd>Meaning</dd></dl></aisf-definitions>
  <aisf-card value="a">A</aisf-card>
</aisf-question>`;

describe('AisfDefinitionsElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should hide the list behind a collapsed toggle when connected', async () => {
    await mount(question);

    expect($('.aisf-definitions-body').hidden).toBe(true);
    expect($('.aisf-definitions-toggle').getAttribute('aria-expanded')).toBe('false');
    expect($('.aisf-definitions-body dt').textContent).toBe('Term');
  });

  it('should show the list when the human opens the toggle', async () => {
    await mount(question);

    await click($('.aisf-definitions-toggle'));

    expect($('.aisf-definitions-body').hidden).toBe(false);
    expect($('.aisf-definitions-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('should hide the list again when the human closes the toggle', async () => {
    await mount(question);
    await click($('.aisf-definitions-toggle'));

    await click($('.aisf-definitions-toggle'));

    expect($('.aisf-definitions-body').hidden).toBe(true);
  });
});
