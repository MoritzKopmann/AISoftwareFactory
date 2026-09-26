import { describe, expect, it } from 'vitest';
import { evaluateSmokeProbe } from '../../../../../src/modules/skills/logic/domain/evaluate-smoke-probe.js';
import type { SmokeProbeReport } from '../../../../../src/modules/skills/logic/domain/smoke-probe-report.js';

const healthyReport: SmokeProbeReport = {
  claudeCodeVersion: '2.1.283',
  skillNames: ['project-testing', 'aisf:commit', 'aisf:implement-ticket'],
};

describe('evaluateSmokeProbe', () => {
  it('should pass when version, project skill and aisf skills are all present', () => {
    expect(evaluateSmokeProbe(healthyReport)).toEqual({ state: 'passed' });
  });

  it('should fail with the found and required versions when Claude Code is too old', () => {
    const result = evaluateSmokeProbe({ ...healthyReport, claudeCodeVersion: '1.9.0' });

    expect(result).toEqual({
      state: 'failed',
      reason: 'Claude Code 2.1.0 or newer is required, found 1.9.0',
    });
  });

  it('should accept a newer major version when the minor is lower', () => {
    expect(evaluateSmokeProbe({ ...healthyReport, claudeCodeVersion: '3.0.0' })).toEqual({
      state: 'passed',
    });
  });

  it('should fail when no bare project skill resolves', () => {
    const result = evaluateSmokeProbe({ ...healthyReport, skillNames: ['aisf:commit'] });

    expect(result).toEqual({
      state: 'failed',
      reason: 'No project-* skill resolved by its bare name',
    });
  });

  it('should fail when no aisf skill resolves', () => {
    const result = evaluateSmokeProbe({ ...healthyReport, skillNames: ['project-testing'] });

    expect(result).toEqual({ state: 'failed', reason: 'No aisf: skill resolved' });
  });
});
