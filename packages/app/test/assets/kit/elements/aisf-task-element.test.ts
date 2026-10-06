// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../../assets/kit/kit.js';
import { $, mount, startPage } from '../fakes/fake-aisf.js';

describe('AisfTaskElement', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startPage(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('should show number, heading, details and a switch that mirrors hitl when the task has them', async () => {
    await mount(
      '<aisf-task number="3" heading="Build" blocked-by="2" files="a.ts" risk="low" hitl>Scope</aisf-task>',
    );

    expect($('.aisf-task-number').textContent).toBe('#3');
    expect($('.aisf-task-heading').textContent).toBe('Build');
    expect($('.aisf-task-blocked-by').textContent).toBe('blocked by: 2');
    expect($('.aisf-task-files').textContent).toBe('files: a.ts');
    expect($('.aisf-task-risk').textContent).toBe('risk: low');
    expect($('.aisf-hitl-switch').getAttribute('aria-checked')).toBe('true');
  });

  it('should flip the hitl hook when the switch is clicked', async () => {
    await mount('<aisf-task number="3" heading="Build">Scope</aisf-task>');

    $('.aisf-hitl-switch').click();

    expect($('aisf-task').hasAttribute('hitl')).toBe(true);
    expect($('.aisf-hitl-switch').getAttribute('aria-checked')).toBe('true');
    expect(document.querySelectorAll('.aisf-hitl-switch')).toHaveLength(1);
  });
});
