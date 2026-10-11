import { describe, expect, it } from 'vitest';
import { IdeaRunNotStartedError } from '../../../../../src/modules/scheduler/logic/errors/idea-run-not-started-error.js';
import { ProjectNotFoundError } from '../../../../../src/modules/scheduler/logic/errors/project-not-found-error.js';
import { RunNotAvailableError } from '../../../../../src/modules/scheduler/logic/errors/run-not-available-error.js';
import { ReadRunAvailabilityUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/read-run-availability-use-case.js';
import { StartIdeaSessionUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/start-idea-session-use-case.js';
import { StartTicketRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/start-ticket-run-use-case.js';
import type {
  ProjectLookup,
  SchedulerProject,
} from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import type { RunsBlocked } from '../../../../../src/modules/scheduler/logic/domain/types/runs-blocked.js';
import {
  FakeIdeaCreation,
  FakeRunnerPort,
  FakeRunsGate,
  FakeTicketLookup,
  readyLeaf,
  repository,
} from '../../fakes/fake-scheduler-ports.js';

const ideaTicket = { ...readyLeaf, number: 501, status: 'idea' as const };

function build(
  options: {
    project?: SchedulerProject | undefined;
    runsBlocked?: RunsBlocked;
    ticket?: typeof ideaTicket | undefined;
  } = {},
) {
  const runner = new FakeRunnerPort();
  const ideaCreation = new FakeIdeaCreation();
  const project = 'project' in options ? options.project : { repository, onboarded: true };
  const projectLookup: ProjectLookup = { find: async () => project };
  const runsGate = new FakeRunsGate(options.runsBlocked);
  const readRunAvailability = new ReadRunAvailabilityUseCase({
    ticketLookup: new FakeTicketLookup('ticket' in options ? options.ticket : ideaTicket),
    runner,
    runsGate,
    projectLookup,
  });
  const startTicketRun = new StartTicketRunUseCase({
    readRunAvailability: (projectId, ticketNumber) =>
      readRunAvailability.execute(projectId, ticketNumber),
    runner,
  });
  const useCase = new StartIdeaSessionUseCase({
    projectLookup,
    runsGate,
    ideaCreation,
    startTicketRun: (projectId, ticketNumber) => startTicketRun.execute(projectId, ticketNumber),
  });
  return { useCase, runner, ideaCreation };
}

describe('StartIdeaSessionUseCase', () => {
  it('should create the idea with an empty body and start a run for it when the project is onboarded', async () => {
    const { useCase, runner, ideaCreation } = build();

    const ticketNumber = await useCase.execute('moritz/aisf', 'Export trips as postcards');

    expect(ticketNumber).toBe(501);
    expect(ideaCreation.calls).toEqual(['create {"title":"Export trips as postcards","body":""}']);
    expect(runner.calls).toEqual(['start moritz/aisf #501']);
  });

  it('should create the idea with its first line as title and the full text as body when the text has several lines', async () => {
    const { useCase, ideaCreation } = build();

    await useCase.execute('moritz/aisf', 'Export trips as postcards\nAs printable cards.');

    expect(ideaCreation.calls).toEqual([
      'create {"title":"Export trips as postcards","body":"Export trips as postcards\\nAs printable cards."}',
    ]);
  });

  it('should throw ProjectNotFoundError and create nothing when the project is unknown', async () => {
    const { useCase, ideaCreation } = build({ project: undefined });

    await expect(useCase.execute('moritz/aisf', 'x')).rejects.toThrow(ProjectNotFoundError);
    expect(ideaCreation.calls).toEqual([]);
  });

  it('should throw RunNotAvailableError and create nothing when runs are blocked', async () => {
    const { useCase, ideaCreation } = build({
      runsBlocked: { blocked: true, reason: 'Usage limit' },
    });

    await expect(useCase.execute('moritz/aisf', 'x')).rejects.toThrow(
      new RunNotAvailableError('Usage limit'),
    );
    expect(ideaCreation.calls).toEqual([]);
  });

  it('should throw RunNotAvailableError and create nothing when the project is not onboarded', async () => {
    const { useCase, ideaCreation } = build({ project: { repository, onboarded: false } });

    await expect(useCase.execute('moritz/aisf', 'x')).rejects.toThrow(RunNotAvailableError);
    expect(ideaCreation.calls).toEqual([]);
  });

  it('should throw IdeaRunNotStartedError with the ticket number when the run fails to start', async () => {
    const { useCase, runner } = build();
    runner.startFailure = new RunNotAvailableError('boom');

    await expect(useCase.execute('moritz/aisf', 'x')).rejects.toThrow(
      new IdeaRunNotStartedError(501, 'boom'),
    );
  });

  it('should throw IdeaRunNotStartedError with the ticket number when the snapshot lacks the new idea', async () => {
    const { useCase } = build({ ticket: undefined });

    await expect(useCase.execute('moritz/aisf', 'x')).rejects.toMatchObject({
      name: 'IdeaRunNotStartedError',
      ticketNumber: 501,
    });
  });
});
