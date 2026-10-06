import { describe, expect, it } from 'vitest';
import { createCheckpointTool } from '../../../../../src/modules/runner/api/tools/create-checkpoint-tool.js';

const runContext = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 137,
  worktreePath: '/worktrees/aisf/137',
};

describe('createCheckpointTool', () => {
  it('should be named aisf_checkpoint', () => {
    expect(createCheckpointTool().name).toBe('aisf_checkpoint');
  });

  it('should return a wait with the request when the input is valid', async () => {
    const request = 'Open http://localhost:5173 and confirm the board shows Waiting';

    const result = await createCheckpointTool().execute({ request }, runContext);

    expect(result).toEqual({ wait: { kind: 'checkpoint', request } });
  });

  it('should describe when to use it, the pause, the public comment and the no-secrets rule', () => {
    const { description } = createCheckpointTool();

    expect(description).toContain('hitl');
    expect(description).toContain('human checkpoint');
    expect(description).toContain('pauses the run');
    expect(description).toContain('public comment');
    expect(description).toContain('no secrets');
  });

  it('should reject when the request is empty', async () => {
    await expect(createCheckpointTool().execute({ request: '' }, runContext)).rejects.toThrow();
  });

  it('should reject when the request is over 10000 characters', async () => {
    await expect(
      createCheckpointTool().execute({ request: 'a'.repeat(10_001) }, runContext),
    ).rejects.toThrow();
  });

  it('should accept the request unchanged when it is exactly 10000 characters', async () => {
    const request = 'a'.repeat(10_000);

    const result = await createCheckpointTool().execute({ request }, runContext);

    expect(result).toEqual({ wait: { kind: 'checkpoint', request } });
  });
});
