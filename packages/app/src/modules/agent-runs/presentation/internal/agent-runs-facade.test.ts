import { beforeEach, describe, expect, it } from 'vitest';
import { ConflictError } from '../../../../shared/errors.js';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import type { Run } from '../../business/domain/types/run.js';
import { CommandLabelService } from '../../business/service/command-label-service.js';
import { RunAnswerService } from '../../business/service/run-answer-service.js';
import { RunMessageService } from '../../business/service/run-message-service.js';
import { RunQueryService } from '../../business/service/run-query-service.js';
import {
  buildRun,
  FakeAgentSessions,
  FakeCommandLabeler,
  FakeCommandLabelRepository,
  FakeRunAnswerWaits,
  FakeRunRepository,
  FakeRunTranscripts,
  FakeSessionFeed,
} from '../../testing/fake-agent-runs-ports.js';
import { toRunDto } from '../dto/mapper/run-mapper.js';
import { AgentRunsFacade, type AgentRunsFacadeServices } from './agent-runs-facade.js';

describe('AgentRunsFacade messages', () => {
  let runRepository: FakeRunRepository;
  let agentSessions: FakeAgentSessions;
  let resume: (runId: string) => Promise<Run>;
  let facade: AgentRunsFacade;
  const resumedRun = buildRun({ id: 'run-2' });

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    agentSessions = new FakeAgentSessions();
    resume = async (): Promise<Run> => resumedRun;
    const sessionFeed = new FakeSessionFeed();
    const runStartService = { resume: (runId: string) => resume(runId) };
    facade = new AgentRunsFacade({
      runMessageService: new RunMessageService({
        runRepository,
        agentSessions,
        sessionFeed,
        runStartService,
      }),
      runAnswerService: new RunAnswerService({
        runRepository,
        runAnswerWaits: new FakeRunAnswerWaits(),
        runStartService,
      }),
      runQueryService: new RunQueryService({
        runRepository,
        runTranscripts: new FakeRunTranscripts(),
        sessionFeed,
        commandLabelService: new CommandLabelService({
          commandLabelRepository: new FakeCommandLabelRepository(),
          commandLabeler: new FakeCommandLabeler(),
        }),
      }),
    } as unknown as AgentRunsFacadeServices);
  });

  it('should return pushed when the live session takes the message', async () => {
    await runRepository.insert(buildRun());

    expect(await facade.sendMessage('run-1', 'x')).toEqual({ kind: 'pushed' });
  });

  it('should return resumed with the run dto when the run is resumed', async () => {
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));

    expect(await facade.sendMessage('run-1', 'x')).toEqual({
      kind: 'resumed',
      run: toRunDto(resumedRun),
    });
  });

  it('should return not-resumable when the run cannot take a message', async () => {
    expect(await facade.sendMessage('missing', 'x')).toEqual({
      kind: 'not-resumable',
      message: 'Run missing cannot take a message',
    });
  });

  it('should return already-active when the ticket has an active run', async () => {
    await runRepository.insert(buildRun({ state: 'ended', ending: { kind: 'finished' } }));
    resume = async (): Promise<Run> => {
      throw new RunAlreadyActiveError('Ticket 138 already has a run');
    };

    expect(await facade.sendMessage('run-1', 'x')).toEqual({
      kind: 'already-active',
      message: 'Ticket 138 already has a run',
    });
  });

  it('should hide a held message from heldAnswer and return it from heldMessage', async () => {
    await runRepository.insert(buildRun({ heldAnswer: { kind: 'message', text: 'a' } }));

    const [paused] = await facade.pausedRuns('moritz/aisf');

    expect(paused?.heldAnswer).toBeNull();
    expect(await facade.heldMessage('run-1')).toBe('a');
  });

  it('should hold a message and let a ConflictError escape', async () => {
    await runRepository.insert(buildRun({ heldAnswer: { kind: 'permission', decision: 'allow' } }));

    await expect(facade.holdMessage('run-1', 'x')).rejects.toBeInstanceOf(ConflictError);
  });

  it('should return null from heldMessage when nothing is held', async () => {
    await runRepository.insert(buildRun());

    expect(await facade.heldMessage('run-1')).toBeNull();
  });
});
