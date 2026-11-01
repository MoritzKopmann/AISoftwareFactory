import { beforeEach, describe, expect, it } from 'vitest';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { Run } from '../domain/types/run.js';
import { RunNotResumableError } from '../errors/run-not-resumable-error.js';
import { RunMessageService } from './run-message-service.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeRunRepository,
  FakeSessionFeed,
} from '../../testing/fake-agent-runs-ports.js';

describe('RunMessageService', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let sessionFeed: FakeSessionFeed;
  let resumed: Array<{ runId: string; answer: RunAnswer }>;
  let service: RunMessageService;
  const resumedRun = buildRun({ id: 'run-2' });

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    sessionFeed = new FakeSessionFeed();
    resumed = [];
    service = new RunMessageService({
      runRepository,
      agentSessions,
      sessionFeed,
      runStartService: {
        resume: async (runId, answer): Promise<Run> => {
          resumed.push({ runId, answer });
          return resumedRun;
        },
      },
    });
  });

  it('should push the message, publish a prompt entry and return undefined when the live session takes it', async () => {
    await runRepository.insert(buildRun());

    const result = await service.send('run-1', 'use the other API');

    const sent = agentSessions.sentMessages;
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ sessionId: 'session-1', text: 'use the other API' });
    expect(sessionFeed.entries('run-1')).toEqual([
      { kind: 'prompt', id: `${sent[0]?.messageId}#0`, text: 'use the other API' },
    ]);
    expect(result).toBeUndefined();
    expect(resumed).toEqual([]);
  });

  it('should resume the run and publish nothing when the session is closed', async () => {
    await runRepository.insert(buildRun());
    agentSessions.sendResult = 'closed';

    const result = await service.send('run-1', 'one more thing');

    expect(result).toBe(resumedRun);
    expect(resumed).toEqual([
      { runId: 'run-1', answer: { kind: 'message', text: 'one more thing' } },
    ]);
    expect(sessionFeed.entries('run-1')).toEqual([]);
  });

  it('should resume the run without sending when the run ended finished', async () => {
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));

    const result = await service.send('run-1', 'one more thing');

    expect(result).toBe(resumedRun);
    expect(agentSessions.sentMessages).toEqual([]);
    expect(resumed).toEqual([
      { runId: 'run-1', answer: { kind: 'message', text: 'one more thing' } },
    ]);
  });

  it('should throw RunNotResumableError when the run ended stopped', async () => {
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'stopped' } }));

    await expect(service.send('run-1', 'hi')).rejects.toThrow(RunNotResumableError);

    expect(resumed).toEqual([]);
    expect(agentSessions.sentMessages).toEqual([]);
  });

  it('should throw RunNotResumableError when the run is unknown', async () => {
    await expect(service.send('missing', 'hi')).rejects.toThrow(RunNotResumableError);
  });
});
