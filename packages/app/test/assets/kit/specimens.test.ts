// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registry } from '../../../assets/kit/kit.js';
import { $$, mount, startPage } from './fakes/fake-aisf.js';

const source = readFileSync(
  resolve(import.meta.dirname, '../../../assets/kit/specimens.html'),
  'utf8',
);

describe('specimens page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should load kit.css and kit.js but not bridge.js when read', () => {
    expect(source).toContain('href="/aisf/kit.css"');
    expect(source).toContain('src="/aisf/kit.js"');
    expect(source).not.toContain('bridge.js');
    expect(source).toContain('data-theme');
  });

  it('should keep the chip rules in context.css and import figures.css when read', () => {
    const styles = resolve(import.meta.dirname, '../../../assets/kit');
    const context = readFileSync(resolve(styles, 'styles/context.css'), 'utf8');
    const kitCss = readFileSync(resolve(styles, 'kit.css'), 'utf8');

    for (const chip of ['lane', 'node', 'node-new', 'node-changed', 'node-untouched', 'arrow']) {
      expect(context).toContain(`.aisf-${chip}`);
    }
    for (const chip of ['stop', 'switch', 'readout']) {
      expect(context).toContain(`.aisf-${chip}`);
    }
    expect(kitCss).toContain("@import './styles/figures.css';");
  });

  it('should show every element, figure class and state when mounted', async () => {
    await mount(
      source.slice(
        source.indexOf('<body>') + 6,
        source.indexOf('<script type="module">', source.indexOf('<body>')),
      ),
    );

    for (const tag of Object.keys(registry)) {
      expect($$(tag).length, tag).toBeGreaterThan(0);
    }
    for (const figureClass of [
      'aisf-lane',
      'aisf-node',
      'aisf-node-new',
      'aisf-node-changed',
      'aisf-node-untouched',
      'aisf-arrow',
      'aisf-stop',
      'aisf-switch',
      'aisf-readout',
    ]) {
      expect($$(`.${figureClass}`).length, figureClass).toBeGreaterThan(0);
    }
    for (const pieceClass of [
      'aisf-compare',
      'aisf-panel',
      'aisf-panel-now',
      'aisf-panel-suggested',
      'aisf-diff',
      'aisf-table',
      'aisf-scope',
      'aisf-scope-in',
      'aisf-scope-out',
      'aisf-shape',
      'aisf-shape-new',
      'aisf-shape-changed',
      'aisf-shape-untouched',
      'aisf-label',
      'aisf-edge',
    ]) {
      expect($$(`.${pieceClass}`).length, pieceClass).toBeGreaterThan(0);
    }
    expect($$('svg.aisf-computed[role="img"]').length).toBeGreaterThanOrEqual(3);
    expect($$('.aisf-shape-flagged').length).toBeGreaterThan(0);
    // The playback map brings its own switches; these two count the static specimen.
    const staticSwitches = $$('.aisf-switch').filter(
      (entry) => entry.closest('aisf-playback') === null,
    );
    expect(
      staticSwitches.filter((entry) => entry.getAttribute('aria-pressed') === 'true'),
    ).toHaveLength(1);
    expect(
      staticSwitches.filter((entry) => entry.getAttribute('aria-pressed') === 'false'),
    ).toHaveLength(1);
    expect($$('aisf-playback .aisf-switch[aria-pressed="true"]')).toHaveLength(1);
    expect($$('aisf-card[gain][cost]').length).toBeGreaterThan(0);
    expect($$('aisf-card[effect] .aisf-card-effect').length).toBeGreaterThan(0);
    expect($$('aisf-question aisf-definitions .aisf-definitions-toggle').length).toBeGreaterThan(0);
    expect($$('aisf-precedent .aisf-precedent-toggle').length).toBeGreaterThan(0);
    expect($$('.aisf-text-answer').length).toBeGreaterThan(0);
    expect(source).not.toMatch(/aisf-other|aisf-discuss/);
    expect($$('aisf-question[problem]').length).toBeGreaterThan(0);
    expect($$('aisf-round[saving]').length).toBeGreaterThan(0);
    expect($$('[data-aisf-status="busy"] .aisf-notice-busy').length).toBeGreaterThan(0);
    expect($$('[data-aisf-status="closed"] .aisf-notice-closed').length).toBeGreaterThan(0);
    expect($$('.aisf-notice-unsaved').length).toBeGreaterThan(0);
    expect($$('aisf-round[frozen] aisf-question .aisf-frozen-summary').length).toBeGreaterThan(0);
    expect($$('aisf-round[frozen] aisf-confirm .aisf-frozen-summary').length).toBeGreaterThan(0);
    expect($$('aisf-question').length).toBeGreaterThanOrEqual(10);
    expect($$('aisf-task').length).toBeGreaterThanOrEqual(12);
  });
});
