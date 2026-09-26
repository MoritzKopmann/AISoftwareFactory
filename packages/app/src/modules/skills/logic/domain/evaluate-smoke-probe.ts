import type { SmokeProbeReport } from './smoke-probe-report.js';
import type { SmokeTestResult } from './skills-status.js';

const minimumClaudeCodeVersion = '2.1.0';
const pluginSkillPrefix = 'aisf:';
const projectSkillPrefix = 'project-';

function isOlderVersion(version: string, minimum: string): boolean {
  const versionParts = version.split('.').map(Number);
  const minimumParts = minimum.split('.').map(Number);
  for (const [index, minimumPart] of minimumParts.entries()) {
    const versionPart = versionParts[index] ?? 0;
    if (versionPart !== minimumPart) {
      return versionPart < minimumPart;
    }
  }
  return false;
}

export function evaluateSmokeProbe(report: SmokeProbeReport): SmokeTestResult {
  if (isOlderVersion(report.claudeCodeVersion, minimumClaudeCodeVersion)) {
    return {
      state: 'failed',
      reason: `Claude Code ${minimumClaudeCodeVersion} or newer is required, found ${report.claudeCodeVersion}`,
    };
  }
  if (!report.skillNames.some((name) => name.startsWith(projectSkillPrefix))) {
    return { state: 'failed', reason: 'No project-* skill resolved by its bare name' };
  }
  if (!report.skillNames.some((name) => name.startsWith(pluginSkillPrefix))) {
    return { state: 'failed', reason: 'No aisf: skill resolved' };
  }
  return { state: 'passed' };
}
