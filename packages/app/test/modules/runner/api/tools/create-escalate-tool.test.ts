import { describe, expect, it } from 'vitest';
import { createEscalateTool } from '../../../../../src/modules/runner/api/tools/create-escalate-tool.js';

const runContext = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 137,
  worktreePath: '/worktrees/aisf/137',
};

import { textResult } from '../../fakes/text-result.js';
describe('createEscalateTool', () => {
  it('should be named aisf_escalate', () => {
    expect(createEscalateTool().name).toBe('aisf_escalate');
  });

  it('should return an escalated ending with the kind and reason when the input is valid', async () => {
    const result = await createEscalateTool().execute(
      { kind: 'spec', reason: 'AC 2 is unprovable' },
      runContext,
    );

    expect(textResult(result).ending).toEqual({
      kind: 'escalated',
      escalation: 'spec',
      reason: 'AC 2 is unprovable',
    });
  });

  it('should tell the session to end its turn when it records the escalation', async () => {
    const result = await createEscalateTool().execute(
      { kind: 'red', reason: 'tests fail' },
      runContext,
    );

    expect(textResult(result).text).toBe(
      'Escalation recorded. The run ends now: stop working and end your turn.',
    );
  });

  it('should reject when the kind is not red, spec or denied', async () => {
    await expect(
      createEscalateTool().execute({ kind: 'other', reason: 'x' }, runContext),
    ).rejects.toThrow();
  });

  it('should reject when the reason is empty', async () => {
    await expect(
      createEscalateTool().execute({ kind: 'red', reason: '' }, runContext),
    ).rejects.toThrow();
  });
});
