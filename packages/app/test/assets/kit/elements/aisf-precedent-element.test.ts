// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, $$, FakeAisf, click, mount, startPage, type } from '../fakes/fake-aisf.js';

const precedentRound = `<aisf-round number="1">
  <aisf-precedent>
    <div name="p1" source="#12">Keep the old name</div>
    <div name="p2" source="#14">Use a map</div>
  </aisf-precedent>
  <aisf-question name="q0" heading="One?">
    <aisf-card value="a">A</aisf-card>
    <aisf-card value="b">B</aisf-card>
  </aisf-question>
</aisf-round>`;

const veto = (name: string) => $(`[name="${name}"] .aisf-veto-switch`);
const note = (name: string) => $<HTMLTextAreaElement>(`[name="${name}"] .aisf-veto-note`);

describe('AisfPrecedentElement', () => {
  let aisf: FakeAisf;
  beforeEach(() => {
    vi.useFakeTimers();
    aisf = new FakeAisf();
    startPage(aisf);
  });
  afterEach(() => vi.useRealTimers());

  async function answerAndSubmit(): Promise<void> {
    await click($('aisf-card[value="a"] input'));
    await click($('.aisf-submit'));
  }

  it('should send an empty veto map when no decision is vetoed', async () => {
    await mount(precedentRound);
    await answerAndSubmit();

    expect(aisf.sent).toHaveLength(1);
    expect(aisf.sent[0]?.payload).toMatchObject({ vetoes: {} });
    expect(aisf.sent[0]?.payload).toHaveProperty('answers');
  });

  it('should send the note with the veto when a decision is vetoed with a note', async () => {
    await mount(precedentRound);
    await click(veto('p1'));
    await type(note('p1'), 'keep the old name');
    await answerAndSubmit();

    expect((aisf.sent[0]?.payload as { vetoes: unknown }).vetoes).toEqual({
      p1: 'keep the old name',
    });
  });

  it('should send an empty note when a decision is vetoed without a note', async () => {
    await mount(precedentRound);
    await click(veto('p2'));
    await answerAndSubmit();

    expect((aisf.sent[0]?.payload as { vetoes: unknown }).vetoes).toEqual({ p2: '' });
  });

  it('should restore the veto and its note when the page reloads', async () => {
    aisf.draft = { rounds: { '1': { vetoes: { p1: 'keep the old name' } } } };
    await mount(precedentRound);

    expect(veto('p1').getAttribute('aria-checked')).toBe('true');
    expect(note('p1').value).toBe('keep the old name');
    expect(veto('p2').getAttribute('aria-checked')).toBe('false');
  });

  it('should save the veto in the draft when a decision is vetoed', async () => {
    await mount(precedentRound);
    await click(veto('p1'));
    await vi.advanceTimersByTimeAsync(600);

    expect(aisf.lastSave).toMatchObject({ rounds: { '1': { vetoes: { p1: '' } } } });
  });

  it('should show the heading once when the element renders', async () => {
    await mount(precedentRound);

    expect(
      $$('aisf-precedent .aisf-precedent-heading').map((heading) => heading.textContent),
    ).toEqual(['Settled by precedent']);
  });

  it('should hold source and how in a collapsed fold-out when the row has them', async () => {
    await mount(
      `<aisf-precedent><div name="p" source="#12" how="same name kept in #12">Keep</div></aisf-precedent>`,
    );

    expect($('[name="p"] .aisf-precedent-text').textContent).toBe('Keep');
    expect($('[name="p"] .aisf-veto-switch')).toBeTruthy();
    expect($('[name="p"] .aisf-precedent-body').hidden).toBe(true);
    expect($('[name="p"] .aisf-precedent-toggle').getAttribute('aria-expanded')).toBe('false');
    expect($('[name="p"] .aisf-precedent-body').textContent).toContain('#12');
    expect($('[name="p"] .aisf-precedent-body').textContent).toContain('same name kept in #12');
  });

  it('should label source and how as pairs when the row has both', async () => {
    await mount(
      `<aisf-precedent><div name="p" source="#12" how="same name">Keep</div></aisf-precedent>`,
    );

    const cells = $$('[name="p"] .aisf-precedent-body > span').map((cell) => cell.textContent);
    expect(cells).toEqual(['Source', '#12', 'How', 'same name']);
  });

  it('should show only the Source pair when the row has no how', async () => {
    await mount(`<aisf-precedent><div name="p" source="#12">Keep</div></aisf-precedent>`);

    const cells = $$('[name="p"] .aisf-precedent-body > span').map((cell) => cell.textContent);
    expect(cells).toEqual(['Source', '#12']);
  });

  it('should open the fold-out when the human clicks its toggle', async () => {
    await mount(`<aisf-precedent><div name="p" source="#12">Keep</div></aisf-precedent>`);

    await click($('[name="p"] .aisf-precedent-toggle'));

    expect($('[name="p"] .aisf-precedent-body').hidden).toBe(false);
    expect($('[name="p"] .aisf-precedent-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('should have no fold-out when the row has neither source nor how', async () => {
    await mount(`<aisf-precedent><div name="p">Keep</div></aisf-precedent>`);

    expect($$('[name="p"] .aisf-precedent-toggle')).toHaveLength(0);
    expect($$('[name="p"] .aisf-precedent-body')).toHaveLength(0);
  });

  it('should name the switch Veto beside a hidden indicator box when the element renders', async () => {
    await mount(precedentRound);

    expect(veto('p1').textContent).toBe('Veto');
    expect(veto('p1').querySelector('.aisf-veto-box')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('should show the note under a visible label when a decision is vetoed', async () => {
    await mount(precedentRound);
    await click(veto('p1'));

    const label = note('p1').closest('label');
    expect(label?.hidden).toBe(false);
    expect(label?.textContent).toBe('Note (optional)');
    expect(note('p1').hasAttribute('aria-label')).toBe(false);
  });

  it('should hide the note label when a veto is lifted', async () => {
    await mount(precedentRound);
    await click(veto('p1'));
    await click(veto('p1'));

    expect(note('p1').closest('label')?.hidden).toBe(true);
  });

  it('should send no vetoes key when the round has no precedent', async () => {
    await mount(`<aisf-round number="1"><aisf-question name="q0" heading="One?">
      <aisf-card value="a">A</aisf-card></aisf-question></aisf-round>`);
    await answerAndSubmit();

    expect(aisf.sent[0]?.payload).not.toHaveProperty('vetoes');
  });
});
