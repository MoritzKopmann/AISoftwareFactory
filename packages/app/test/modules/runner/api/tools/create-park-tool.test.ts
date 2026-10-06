import { describe, expect, it } from 'vitest';
import { createParkTool } from '../../../../../src/modules/runner/api/tools/create-park-tool.js';

const runContext = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 137,
  worktreePath: '/worktrees/aisf/137',
};

import { textResult } from '../../fakes/text-result.js';
describe('createParkTool', () => {
  it('should be named aisf_park', () => {
    expect(createParkTool().name).toBe('aisf_park');
  });

  it('should return a parked ending with the blocker number when the input is valid', async () => {
    const result = await createParkTool().execute({ blocker: 42 }, runContext);

    expect(textResult(result).ending).toEqual({ kind: 'parked', blockerNumber: 42 });
  });

  it('should tell the session to end its turn when it records the park', async () => {
    const result = await createParkTool().execute({ blocker: 42 }, runContext);

    expect(textResult(result).text).toBe(
      'Park recorded. The run ends now: stop working and end your turn.',
    );
  });

  it('should reject when the blocker is not a positive whole number', async () => {
    await expect(createParkTool().execute({ blocker: 0 }, runContext)).rejects.toThrow();
    await expect(createParkTool().execute({ blocker: 1.5 }, runContext)).rejects.toThrow();
  });
});
