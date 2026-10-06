// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfQuestionElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should show the heading, the assumes line and the Other and Discuss choices when connected', async () => {
    await mount(
      '<aisf-question name="q" heading="Which?" assumes="a1"><p>body</p><aisf-card value="x">X</aisf-card></aisf-question>',
    );

    expect($('.aisf-question-heading').textContent).toBe('Which?');
    expect($('.aisf-question-assumes').textContent).toBe('assumes: a1');
    expect($('.aisf-choices .aisf-choice-other .aisf-other-text')).toBeTruthy();
    expect($('.aisf-choices .aisf-choice-discuss .aisf-discuss-note')).toBeTruthy();
    expect($('.aisf-choices aisf-card')).toBeTruthy();
  });

  it('should choose Other when the human types into its field', async () => {
    await mount('<aisf-question name="q"><aisf-card value="x">X</aisf-card></aisf-question>');
    const text = $<HTMLInputElement>('.aisf-other-text');

    text.value = 'mine';
    text.dispatchEvent(new Event('input', { bubbles: true }));

    expect($<HTMLInputElement>('.aisf-other-radio').checked).toBe(true);
    expect($('aisf-question').hasAttribute('answered')).toBe(true);
  });
});
