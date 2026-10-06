import { beforeEach, describe, expect, it } from 'vitest';
import { ArtifactNotFoundError } from '../../../../../src/modules/bridge/logic/errors/artifact-not-found-error.js';
import { PageBusyError } from '../../../../../src/modules/bridge/logic/errors/page-busy-error.js';
import { PageClosedError } from '../../../../../src/modules/bridge/logic/errors/page-closed-error.js';
import { SubmitPageEventUseCase } from '../../../../../src/modules/bridge/logic/use-cases/submit-page-event-use-case.js';
import { buildArtifact } from '../../fakes/build-artifact.js';
import { FakeCheckpointAnswers } from '../../fakes/fake-checkpoint-answers.js';
import { FakeTicketRunLookup } from '../../fakes/fake-ticket-run-lookup.js';
import { InMemoryArtifactRepository } from '../../fakes/in-memory-artifact-repository.js';

const event = { kind: 'submit', round: 2, payload: { a: 1 } } as const;
const tagged = '<aisf-event artifact=plan kind=submit round=2>{"a":1}</aisf-event>';

describe('SubmitPageEventUseCase', () => {
  let ticketRunLookup: FakeTicketRunLookup;
  let checkpointAnswers: FakeCheckpointAnswers;
  let submit: SubmitPageEventUseCase;

  beforeEach(() => {
    const artifactRepository = new InMemoryArtifactRepository();
    artifactRepository.add(buildArtifact());
    ticketRunLookup = new FakeTicketRunLookup();
    checkpointAnswers = new FakeCheckpointAnswers();
    submit = new SubmitPageEventUseCase({ artifactRepository, ticketRunLookup, checkpointAnswers });
  });

  it('should deliver the tagged text to the run when the run waits on the page', async () => {
    ticketRunLookup.latestRun = { id: 'r1', state: 'running', waitingFor: { artifactId: 'plan' } };

    await submit.execute('T', event);

    expect(checkpointAnswers.calls).toEqual([{ runId: 'r1', text: tagged }]);
  });

  it('should deliver when the run ended at a checkpoint on the page', async () => {
    ticketRunLookup.latestRun = {
      id: 'r1',
      state: 'ended',
      ending: { kind: 'checkpoint', artifactId: 'plan' },
    };

    await submit.execute('T', event);

    expect(checkpointAnswers.calls).toEqual([{ runId: 'r1', text: tagged }]);
  });

  it('should throw closed and deliver nothing when the run does not wait', async () => {
    ticketRunLookup.latestRun = { id: 'r1', state: 'running' };

    await expect(submit.execute('T', event)).rejects.toThrow(PageClosedError);
    expect(checkpointAnswers.calls).toEqual([]);
  });

  it('should throw busy and deliver nothing when another run is running', async () => {
    ticketRunLookup.latestRun = { id: 'r2', state: 'running' };

    await expect(submit.execute('T', event)).rejects.toThrow(PageBusyError);
    expect(checkpointAnswers.calls).toEqual([]);
  });

  it('should pass on busy when the scheduler refuses the answer', async () => {
    ticketRunLookup.latestRun = { id: 'r1', state: 'running', waitingFor: { artifactId: 'plan' } };
    checkpointAnswers.failure = new PageBusyError('refused');

    await expect(submit.execute('T', event)).rejects.toThrow(PageBusyError);
  });

  it('should throw when the token is unknown', async () => {
    await expect(submit.execute('nope', event)).rejects.toThrow(ArtifactNotFoundError);
  });
});
