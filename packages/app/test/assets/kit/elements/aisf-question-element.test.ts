// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, click, mount, startPage, type } from '../fakes/fake-aisf.js';

describe('AisfQuestionElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should show the heading, the assumes line and the text field when connected', async () => {
    await mount(
      '<aisf-question name="q" heading="Which?" assumes="a1"><p>body</p><aisf-card value="x">X</aisf-card></aisf-question>',
    );

    expect($('.aisf-question-heading').textContent).toBe('Which?');
    expect($('.aisf-question-assumes').textContent).toBe('assumes: a1');
    expect($('.aisf-choices .aisf-text-answer')).toBeTruthy();
    expect($('.aisf-choices aisf-card')).toBeTruthy();
  });

  it('should have no Other and no Discuss choice when rendered', async () => {
    await mount('<aisf-question name="q"><aisf-card value="x">X</aisf-card></aisf-question>');

    expect(document.querySelector('.aisf-other-radio, .aisf-discuss-radio')).toBeNull();
    expect(document.querySelector('.aisf-choice-other, .aisf-choice-discuss')).toBeNull();
  });

  it('should place the parts in order when written in another order', async () => {
    await mount(
      `<aisf-question name="q" heading="H" problem="P">
        <aisf-card value="a">A</aisf-card>
        <aisf-figure caption="c"></aisf-figure>
        <aisf-definitions><dl><dt>T</dt><dd>M</dd></dl></aisf-definitions>
      </aisf-question>`,
    );

    const parts = [...$('aisf-question').children].map(
      (child) => child.className || child.tagName.toLowerCase(),
    );
    expect(parts).toEqual([
      'aisf-question-heading',
      'aisf-question-problem',
      'aisf-definitions',
      'aisf-figure',
      'aisf-choices',
    ]);
    const choices = [...$('.aisf-choices').children].map((child) => child.tagName.toLowerCase());
    expect(choices).toEqual(['aisf-card', 'label']);
  });

  it('should answer with the text and clear the card when the human types', async () => {
    await mount(
      '<aisf-question name="q"><aisf-card value="a">A</aisf-card><aisf-card value="b">B</aisf-card></aisf-question>',
    );
    await click($('aisf-card[value=a] input'));

    await type($<HTMLTextAreaElement>('.aisf-text-answer'), 'use a queue');

    expect($<HTMLInputElement>('aisf-card[value=a] input').checked).toBe(false);
    expect($('aisf-question').hasAttribute('answered')).toBe(true);
    expect(($('aisf-question') as unknown as { answer: unknown }).answer).toEqual({
      question: 'q',
      choice: 'text',
      text: 'use a queue',
    });
  });

  it('should clear the text when the human picks a card', async () => {
    await mount(
      '<aisf-question name="q"><aisf-card value="a">A</aisf-card><aisf-card value="b">B</aisf-card></aisf-question>',
    );
    await type($<HTMLTextAreaElement>('.aisf-text-answer'), 'use a queue');

    await click($('aisf-card[value=b] input'));

    expect($<HTMLTextAreaElement>('.aisf-text-answer').value).toBe('');
    expect(($('aisf-question') as unknown as { answer: unknown }).answer).toEqual({
      question: 'q',
      choice: 'b',
    });
  });

  it('should not count the question as answered when the text is only spaces', async () => {
    await mount('<aisf-question name="q"><aisf-card value="a">A</aisf-card></aisf-question>');

    await type($<HTMLTextAreaElement>('.aisf-text-answer'), '   ');

    expect($('aisf-question').hasAttribute('answered')).toBe(false);
  });

  it('should put a radio mark before the label when rendered', async () => {
    await mount('<aisf-question name="q"><aisf-card value="a">A</aisf-card></aisf-question>');

    const label = $('.aisf-text-label');
    expect(label.firstElementChild?.classList.contains('aisf-text-radio')).toBe(true);
    expect(label.textContent).toBe('Or write your own answer');
  });

  it('should focus the text box and leave the question unanswered when the human clicks the radio mark', async () => {
    await mount('<aisf-question name="q"><aisf-card value="a">A</aisf-card></aisf-question>');

    await click($('.aisf-text-radio'));

    expect(document.activeElement).toBe($('.aisf-text-answer'));
    expect($('aisf-question').hasAttribute('answered')).toBe(false);
  });

  it('should mark the text field selected when the text is the answer', async () => {
    await mount('<aisf-question name="q"><aisf-card value="a">A</aisf-card></aisf-question>');

    await type($<HTMLTextAreaElement>('.aisf-text-answer'), 'use a queue');

    expect($('.aisf-text-field').hasAttribute('selected')).toBe(true);
  });

  it('should keep the text field unselected when the text is only spaces', async () => {
    await mount('<aisf-question name="q"><aisf-card value="a">A</aisf-card></aisf-question>');

    await type($<HTMLTextAreaElement>('.aisf-text-answer'), '   ');

    expect($('.aisf-text-field').hasAttribute('selected')).toBe(false);
  });

  it('should unselect the text field when the human picks a card', async () => {
    await mount('<aisf-question name="q"><aisf-card value="a">A</aisf-card></aisf-question>');
    await type($<HTMLTextAreaElement>('.aisf-text-answer'), 'use a queue');

    await click($('aisf-card[value=a] input'));

    expect($('.aisf-text-field').hasAttribute('selected')).toBe(false);
  });

  it('should show the problem after the heading when the question has one', async () => {
    await mount(
      '<aisf-question name="q" heading="H" problem="P"><aisf-card value="x">X</aisf-card></aisf-question>',
    );

    const parts = [...$('aisf-question').children].map((child) => child.className);
    expect($('.aisf-question-problem').textContent).toBe('P');
    expect(parts.indexOf('aisf-question-problem')).toBe(parts.indexOf('aisf-question-heading') + 1);
  });

  it('should show no problem when the attribute is absent', async () => {
    await mount(
      '<aisf-question name="q" heading="H"><aisf-card value="x">X</aisf-card></aisf-question>',
    );

    expect(document.querySelector('.aisf-question-problem')).toBeNull();
  });
});
