// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, $$, FakeAisf, click, mount, startPage, type } from '../fakes/fake-aisf.js';

const confirmRound = `<aisf-round number="3"><aisf-confirm>
  <aisf-task number="3" heading="Three" hitl>Scope</aisf-task>
  <aisf-task number="4" heading="Four">Scope</aisf-task>
</aisf-confirm></aisf-round>`;

describe('AisfConfirmElement', () => {
  let aisf: FakeAisf;
  beforeEach(() => {
    vi.useFakeTimers();
    aisf = new FakeAisf();
    startPage(aisf);
  });
  afterEach(() => vi.useRealTimers());

  it('should send the decision with every task toggle and freeze it when Confirm is pressed', async () => {
    await mount(confirmRound);
    await click($('aisf-task[number="4"] .aisf-hitl-switch'));

    await click($('.aisf-confirm-button'));

    expect(aisf.sent).toEqual([
      { kind: 'confirm', round: 3, payload: { hitl: { '3': true, '4': true } } },
    ]);
    expect($('aisf-round').hasAttribute('frozen')).toBe(true);
    expect($('.aisf-summary-decision').textContent).toBe('Confirmed');
    expect($$<HTMLButtonElement>('.aisf-hitl-switch').every((button) => button.disabled)).toBe(
      true,
    );
  });

  it('should send nothing and focus the note when Reopen is pressed with an empty note', async () => {
    await mount(confirmRound);

    await click($('.aisf-reopen-button'));

    expect(aisf.sent).toHaveLength(0);
    expect(document.activeElement).toBe($('.aisf-confirm-note'));
  });

  it('should send a reopen with the note when Reopen is pressed with a note', async () => {
    await mount(confirmRound);
    await type($('.aisf-confirm-note'), 'redo');

    await click($('.aisf-reopen-button'));

    expect(aisf.sent).toEqual([
      { kind: 'reopen', round: 3, payload: { note: 'redo', hitl: { '3': true, '4': false } } },
    ]);
    expect($('.aisf-summary-decision').textContent).toBe('Reopened');
    expect($('.aisf-summary-note').textContent).toBe('redo');
  });

  it('should restore the switches from the draft when the page reloads', async () => {
    aisf.draft = { rounds: { '3': { note: 'n', hitl: { '3': false, '4': true } } } };

    await mount(confirmRound);

    expect($('aisf-task[number="3"]').hasAttribute('hitl')).toBe(false);
    expect($('aisf-task[number="4"]').hasAttribute('hitl')).toBe(true);
    expect($<HTMLTextAreaElement>('.aisf-confirm-note').value).toBe('n');
  });

  it('should save the toggles as a draft when a switch is turned', async () => {
    await mount(confirmRound);

    await click($('aisf-task[number="4"] .aisf-hitl-switch'));
    await vi.advanceTimersByTimeAsync(600);

    expect(aisf.lastSave).toMatchObject({ rounds: { '3': { hitl: { '3': true, '4': true } } } });
  });
});
