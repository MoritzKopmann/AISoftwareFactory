import { describe, expect, it } from 'vitest';
import type { RunAnswer } from '../../../../../src/modules/scheduler/logic/domain/types/run-answer.js';
import type { RunRecord } from '../../../../../src/modules/scheduler/logic/domain/types/run-record.js';
import { RunNotAnswerableError } from '../../../../../src/modules/scheduler/logic/errors/run-not-answerable-error.js';
import { AnswerRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/answer-run-use-case.js';
import { FakeRunnerPort, FakeTicketAnswerGate } from '../../fakes/fake-scheduler-ports.js';

const permissionRun: RunRecord = {
  id: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 147,
  startedAt: '2026-09-29T09:00:00.000Z',
  endedAt: '2026-09-29T09:30:00.000Z',
  ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'git push' } },
};

const checkpointRun: RunRecord = {
  ...permissionRun,
  ending: { kind: 'checkpoint', request: 'Check the login page' },
};

const liveRun: RunRecord = {
  id: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 147,
  startedAt: '2026-09-29T09:00:00.000Z',
  waitingFor: { kind: 'checkpoint', request: 'Pick A or B' },
};

const allowAnswer: RunAnswer = { kind: 'permission', decision: 'allow' };
const checkpointAnswer: RunAnswer = { kind: 'checkpoint', text: 'Looks good' };

function buildSubject(run: RunRecord = permissionRun) {
  const ticketAnswerGate = new FakeTicketAnswerGate();
  const runner = new FakeRunnerPort();
  runner.record = run;
  runner.latest = {
    id: run.id,
    startedAt: run.startedAt,
    ...(run.endedAt === undefined ? {} : { endedAt: run.endedAt }),
    ...(run.ending === undefined ? {} : { ending: run.ending }),
  };
  const useCase = new AnswerRunUseCase({ ticketAnswerGate, runner });
  return { useCase, ticketAnswerGate, runner };
}

function answersOf(runner: FakeRunnerPort): string[] {
  return runner.calls.filter((call) => call.startsWith('answer'));
}

describe('AnswerRunUseCase', () => {
  it.each<[string, RunRecord, RunAnswer]>([
    ['a checkpoint answer to an ended checkpoint run', checkpointRun, checkpointAnswer],
    ['a checkpoint answer to a live checkpoint wait', liveRun, checkpointAnswer],
    ['an allow decision', permissionRun, allowAnswer],
    ['a deny decision', permissionRun, { kind: 'permission', decision: 'deny' }],
  ])(
    'should begin the gate before resuming the run when the answer is %s',
    async (_name, run, answer) => {
      const { useCase, ticketAnswerGate, runner } = buildSubject(run);
      const resume = runner.answer.bind(runner);
      runner.answer = async (runId, resumeAnswer) => {
        ticketAnswerGate.calls.push('answer reached');
        return resume(runId, resumeAnswer);
      };

      const resumedRun = await useCase.execute('run-1', answer);

      expect(resumedRun).toEqual({ id: 'run-2', startedAt: '2026-09-29T11:00:00.000Z' });
      expect(ticketAnswerGate.calls).toEqual(['begin moritz/aisf #147', 'answer reached']);
      expect(answersOf(runner)).toEqual([`answer run-1 ${JSON.stringify(answer)}`]);
    },
  );

  it('should revert the gate and rethrow when the runner cannot resume', async () => {
    const { useCase, ticketAnswerGate, runner } = buildSubject();
    const failure = new Error('worktree is gone');
    runner.answerFailure = failure;

    await expect(useCase.execute('run-1', allowAnswer)).rejects.toBe(failure);

    expect(ticketAnswerGate.calls).toEqual(['begin moritz/aisf #147', 'revert moritz/aisf #147']);
  });

  it('should rethrow and not resume the run when the gate refuses to begin', async () => {
    const { useCase, ticketAnswerGate, runner } = buildSubject();
    const refusal = new RunNotAnswerableError('#147 is not waiting');
    ticketAnswerGate.beginFailure = refusal;

    await expect(useCase.execute('run-1', allowAnswer)).rejects.toBe(refusal);

    expect(ticketAnswerGate.calls).toEqual(['begin moritz/aisf #147']);
    expect(answersOf(runner)).toEqual([]);
  });

  it.each([
    [
      'the run did not end needing permission',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.record = { ...permissionRun, ending: { kind: 'finished' } };
      },
    ],
    [
      'the run is unknown',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.record = undefined;
      },
    ],
    [
      'a newer run exists for the ticket',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.latest = { id: 'run-9', startedAt: '2026-09-29T10:00:00.000Z' };
      },
    ],
    [
      'the run neither ended nor waits',
      (subject: ReturnType<typeof buildSubject>) => {
        subject.runner.record = {
          id: permissionRun.id,
          projectId: permissionRun.projectId,
          ticketNumber: permissionRun.ticketNumber,
          startedAt: permissionRun.startedAt,
        };
      },
    ],
  ])('should refuse and touch nothing when %s', async (_situation, arrange) => {
    const subject = buildSubject();
    arrange(subject);

    await expect(subject.useCase.execute('run-1', allowAnswer)).rejects.toThrow(
      RunNotAnswerableError,
    );

    expect(subject.ticketAnswerGate.calls).toEqual([]);
    expect(answersOf(subject.runner)).toEqual([]);
  });

  it.each<[string, RunRecord, RunAnswer]>([
    ['a checkpoint answer to a permission run', permissionRun, checkpointAnswer],
    ['a permission answer to a checkpoint run', checkpointRun, allowAnswer],
    ['a permission answer to a live checkpoint wait', liveRun, allowAnswer],
  ])('should refuse and touch nothing when the pair is %s', async (_name, run, answer) => {
    const subject = buildSubject(run);

    await expect(subject.useCase.execute('run-1', answer)).rejects.toThrow(RunNotAnswerableError);

    expect(subject.ticketAnswerGate.calls).toEqual([]);
    expect(answersOf(subject.runner)).toEqual([]);
  });
});
