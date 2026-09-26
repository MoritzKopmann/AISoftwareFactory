import { describe, expect, it } from 'vitest';
import { findPreflightProblems } from '../../src/cli/preflight.js';

const everythingPresent = (command: string): boolean => ['gh', 'claude'].includes(command);

describe('findPreflightProblems', () => {
  it('should report nothing when node, gh and claude are all present', () => {
    expect(findPreflightProblems({ nodeVersion: '22.0.0', isOnPath: everythingPresent })).toEqual(
      [],
    );
  });

  it('should name gh when gh is missing from PATH', () => {
    const problems = findPreflightProblems({
      nodeVersion: '22.4.1',
      isOnPath: (command) => command === 'claude',
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('gh');
  });

  it('should name claude when claude is missing from PATH', () => {
    const problems = findPreflightProblems({
      nodeVersion: '22.4.1',
      isOnPath: (command) => command === 'gh',
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('claude');
  });

  it('should name the node version when node is older than 22', () => {
    const problems = findPreflightProblems({ nodeVersion: '20.11.0', isOnPath: everythingPresent });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Node');
    expect(problems[0]).toContain('20.11.0');
  });

  it('should report every problem when several checks fail', () => {
    const problems = findPreflightProblems({ nodeVersion: '18.19.1', isOnPath: () => false });

    expect(problems).toHaveLength(3);
  });
});
