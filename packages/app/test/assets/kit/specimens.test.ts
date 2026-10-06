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
    expect($$('.aisf-switch[aria-pressed="true"]')).toHaveLength(1);
    expect($$('.aisf-switch[aria-pressed="false"]')).toHaveLength(1);
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
