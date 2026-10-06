// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfMetaElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should show the label before the value when the meta has a label', async () => {
    await mount('<aisf-meta label="Risk">Low</aisf-meta>');

    expect($('aisf-meta .aisf-meta-label').textContent).toBe('Risk');
    expect($('aisf-meta').textContent).toBe('RiskLow');
  });

  it('should change the label when the attribute changes', async () => {
    await mount('<aisf-meta label="Risk">Low</aisf-meta>');

    $('aisf-meta').setAttribute('label', 'Effort');

    expect($('aisf-meta .aisf-meta-label').textContent).toBe('Effort');
    expect(document.querySelectorAll('.aisf-meta-label')).toHaveLength(1);
  });
});
