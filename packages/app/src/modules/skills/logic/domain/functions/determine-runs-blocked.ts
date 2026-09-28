import type { RunsBlocked, SkillsStatus } from '../types/skills-status.js';

export function determineRunsBlocked(status: SkillsStatus): RunsBlocked {
  switch (status.state) {
    case 'passed':
      return { blocked: false };
    case 'failed':
      return { blocked: true, reason: status.reason };
    case 'pending':
      return { blocked: true, reason: 'Skills start-up checks have not finished' };
  }
}
