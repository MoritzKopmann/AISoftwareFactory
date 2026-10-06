// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, $$, FakeAisf, click, mount, settle, startPage, type } from '../fakes/fake-aisf.js';

const questions = (count: number, extra = ''): string =>
  Array.from(
    { length: count },
    (_, index) =>
      `<aisf-question name="q${index}" heading="Question ${index}" assumes="a${index}">
        <aisf-card value="one"${index === 1 ? ' suggested' : ''}>First</aisf-card>
        <aisf-card value="two">Second</aisf-card>
      </aisf-question>`,
  ).join('') + extra;

const round = (number: number, body: string): string =>
  `<aisf-round number="${number}">${body}</aisf-round>`;

const pick = (name: string, value: string) =>
  click($(`aisf-question[name="${name}"] aisf-card[value="${value}"] input`));

describe('AisfRoundElement', () => {
  let aisf: FakeAisf;
  beforeEach(() => {
    vi.useFakeTimers();
    aisf = new FakeAisf();
    startPage(aisf);
  });
  afterEach(() => vi.useRealTimers());

  it('should select the card, mark the question and save the draft when the human picks a card', async () => {
    await mount(round(1, questions(1)));

    await pick('q0', 'two');
    await vi.advanceTimersByTimeAsync(600);

    expect($('aisf-card[value="two"]').hasAttribute('selected')).toBe(true);
    expect($('aisf-card[value="one"]').hasAttribute('selected')).toBe(false);
    expect($('aisf-question').hasAttribute('answered')).toBe(true);
    expect(aisf.lastSave).toMatchObject({
      rounds: { '1': { answers: { q0: { choice: 'two' } } } },
    });
  });

  it('should save once with the final text when the human types quickly into Other', async () => {
    await mount(round(1, questions(1)));
    const text = $<HTMLInputElement>('.aisf-other-text');

    for (const value of ['a', 'ab', 'abc']) {
      await type(text, value);
      await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(600);

    expect(aisf.saves).toHaveLength(1);
    expect(aisf.lastSave).toMatchObject({
      rounds: { '1': { answers: { q0: { choice: 'other', text: 'abc' } } } },
    });
  });

  it('should show the notice, keep answers and Submit and drop the notice when a later save works', async () => {
    await mount(round(1, questions(1)));
    aisf.saveFails = true;
    await pick('q0', 'one');

    await vi.advanceTimersByTimeAsync(600);

    expect($('.aisf-notice-unsaved').textContent).toBe('Draft not saved');
    expect($<HTMLInputElement>('aisf-card[value="one"] input').checked).toBe(true);
    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(false);
    aisf.saveFails = false;
    await pick('q0', 'two');
    await vi.advanceTimersByTimeAsync(600);
    expect(document.querySelector('.aisf-notice-unsaved')).toBeNull();
  });

  it('should restore choice, text and note and mark each answered when a draft is loaded', async () => {
    aisf.draft = {
      rounds: {
        '1': {
          answers: {
            q0: { choice: 'two' },
            q1: { choice: 'other', text: 'mine' },
            q2: { choice: 'discuss', note: 'talk' },
          },
        },
      },
    };

    await mount(round(1, questions(3)));

    expect($<HTMLInputElement>('aisf-question[name=q0] aisf-card[value=two] input').checked).toBe(
      true,
    );
    expect($<HTMLInputElement>('aisf-question[name=q1] .aisf-other-text').value).toBe('mine');
    expect($<HTMLInputElement>('aisf-question[name=q2] .aisf-discuss-note').value).toBe('talk');
    expect($$('aisf-question[answered]')).toHaveLength(3);
  });

  it('should start empty with Submit locked when there is no draft', async () => {
    await mount(round(1, questions(2)));

    expect($$('aisf-question[answered]')).toHaveLength(0);
    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(true);
  });

  it('should not count Other as answered when its text is empty', async () => {
    await mount(round(1, questions(1)));

    await click($('.aisf-other-radio'));

    expect($('aisf-question').hasAttribute('answered')).toBe(false);
    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(true);
  });

  it('should count Discuss as answered when it has no note', async () => {
    await mount(round(1, questions(1)));

    await click($('.aisf-discuss-radio'));

    expect($('aisf-question').hasAttribute('answered')).toBe(true);
  });

  it('should unlock Submit and count answers when every question is answered', async () => {
    await mount(round(1, questions(3)));
    await pick('q0', 'one');
    await pick('q1', 'one');

    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(true);
    expect($('.aisf-answered-count').textContent).toBe('2 of 3');
    await pick('q2', 'one');
    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(false);
  });

  it('should fill only open questions that have a suggestion when Accept all remaining is pressed', async () => {
    await mount(round(1, questions(3)));
    await pick('q0', 'two');

    await click($('.aisf-accept-all'));
    await vi.advanceTimersByTimeAsync(600);

    const checked = (name: string) =>
      $$<HTMLInputElement>(`aisf-question[name=${name}] aisf-card input`).map(
        (input) => input.checked,
      );
    expect(checked('q0')).toEqual([false, true]);
    expect(checked('q1')).toEqual([true, false]);
    expect(checked('q2')).toEqual([false, false]);
    expect($('aisf-question[name=q2]').hasAttribute('answered')).toBe(false);
    expect(aisf.saves.length).toBeGreaterThan(0);
  });

  it('should send one submit event and mark the round saving until the send settles when Submit is pressed', async () => {
    let finish: (result: { ok: true }) => void = () => undefined;
    aisf.send = (event) => {
      aisf.sent.push(structuredClone(event));
      return new Promise((resolve) => {
        finish = resolve as typeof finish;
      });
    };
    await mount(round(2, questions(2)));
    await pick('q0', 'one');
    await pick('q1', 'two');

    await click($('.aisf-submit'));

    expect(aisf.sent).toEqual([
      {
        kind: 'submit',
        round: 2,
        payload: {
          answers: [
            { question: 'q0', choice: 'one' },
            { question: 'q1', choice: 'two' },
          ],
        },
      },
    ]);
    expect($('aisf-round').hasAttribute('saving')).toBe(true);
    expect($$<HTMLInputElement>('aisf-round input').every((input) => input.disabled)).toBe(true);
    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(true);
    finish({ ok: true });
    await settle();
    expect($('aisf-round').hasAttribute('saving')).toBe(false);
  });

  it('should freeze the round with a summary and record it as submitted when the send is acknowledged', async () => {
    await mount(round(1, questions(2)));
    await pick('q0', 'one');
    await pick('q1', 'two');

    await click($('.aisf-submit'));

    expect($('aisf-round').hasAttribute('frozen')).toBe(true);
    const summary = $$('aisf-question[name=q0] .aisf-frozen-summary span').map(
      (part) => part.textContent,
    );
    expect(summary).toEqual(['Question 0', 'First', 'assumes: a0']);
    expect(aisf.lastSave).toMatchObject({ rounds: { '1': { submitted: 'submit' } } });
  });

  it('should freeze earlier rounds and restore the draft of the open one when a page is republished', async () => {
    aisf.draft = {
      rounds: {
        '1': { submitted: 'submit', answers: { q0: { choice: 'two' } } },
        '2': { answers: { q0: { choice: 'one' } } },
      },
    };

    await mount(round(1, questions(1)) + round(2, questions(1)));

    const [first, second] = $$('aisf-round');
    expect(first?.hasAttribute('frozen')).toBe(true);
    expect(first?.querySelector('.aisf-summary-answer')?.textContent).toBe('Second');
    expect(second?.hasAttribute('frozen')).toBe(false);
    expect(second?.querySelector<HTMLInputElement>('aisf-card[value=one] input')?.checked).toBe(
      true,
    );
  });

  it('should keep the draft, enable Submit and show the busy notice when the send answers busy', async () => {
    aisf.sendResult = { ok: false, status: 'busy' };
    await mount(round(1, questions(1)));
    await pick('q0', 'one');

    await click($('.aisf-submit'));

    expect($('aisf-round').hasAttribute('frozen')).toBe(false);
    expect($<HTMLInputElement>('aisf-card[value=one] input').checked).toBe(true);
    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(false);
    expect($('.aisf-notice-busy')).toBeTruthy();
  });

  it('should make every round read-only and show the closed notice when the status turns closed', async () => {
    await mount(round(1, questions(1)));
    await pick('q0', 'one');

    aisf.emitStatus('closed');

    expect($('.aisf-notice-closed')).toBeTruthy();
    expect($<HTMLInputElement>('aisf-card input').disabled).toBe(true);
    expect($<HTMLButtonElement>('.aisf-submit').disabled).toBe(true);
    await click($('.aisf-submit'));
    expect(aisf.sent).toHaveLength(0);
  });

  it('should close the page when the send answers closed', async () => {
    aisf.sendResult = { ok: false, status: 'closed' };
    await mount(round(1, questions(1)));
    await pick('q0', 'one');

    await click($('.aisf-submit'));

    expect($('.aisf-notice-closed')).toBeTruthy();
    expect($<HTMLInputElement>('aisf-card input').disabled).toBe(true);
  });

  it('should drop the busy notice and take answers again when the status returns to open', async () => {
    await mount(round(1, questions(1)));

    aisf.emitStatus('busy');
    expect($('.aisf-notice-busy')).toBeTruthy();
    aisf.emitStatus('open');

    expect(document.querySelector('.aisf-notice-busy')).toBeNull();
    expect($<HTMLInputElement>('aisf-card input').disabled).toBe(false);
  });

  it('should render with the markup state hooks and send nothing when there is no bridge', async () => {
    startPage(undefined);
    await mount(
      round(1, questions(1)).replace('<aisf-card value="one"', '<aisf-card selected value="one"'),
    );

    expect($('aisf-card[value=one]').hasAttribute('selected')).toBe(true);
    expect($('aisf-question').hasAttribute('answered')).toBe(true);
    await click($('.aisf-submit'));
    expect($('aisf-round').hasAttribute('frozen')).toBe(false);
  });

  it('should keep a frozen hook written in markup when there is no bridge', async () => {
    startPage(undefined);
    await mount('<aisf-round number="1" frozen>' + questions(1) + '</aisf-round>');

    expect($('aisf-round').hasAttribute('frozen')).toBe(true);
    expect($('.aisf-frozen-summary')).toBeTruthy();
  });
});
