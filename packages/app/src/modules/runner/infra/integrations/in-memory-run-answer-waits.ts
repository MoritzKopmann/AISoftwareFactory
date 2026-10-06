import type { RunAnswerWaitOutcome, RunAnswerWaits } from '../../logic/ports/run-answer-waits.js';

export class InMemoryRunAnswerWaits implements RunAnswerWaits {
  private readonly settlersByRunId = new Map<string, (outcome: RunAnswerWaitOutcome) => void>();

  wait(runId: string, windowMilliseconds: number): Promise<RunAnswerWaitOutcome> {
    this.settlersByRunId.get(runId)?.({ kind: 'cancelled' });
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.settle(runId, { kind: 'expired' }), windowMilliseconds);
      this.settlersByRunId.set(runId, (outcome) => {
        clearTimeout(timer);
        resolve(outcome);
      });
    });
  }

  deliver(runId: string, text: string): boolean {
    return this.settle(runId, { kind: 'answered', text });
  }

  cancel(runId: string): void {
    this.settle(runId, { kind: 'cancelled' });
  }

  private settle(runId: string, outcome: RunAnswerWaitOutcome): boolean {
    const settler = this.settlersByRunId.get(runId);
    if (settler === undefined) {
      return false;
    }
    this.settlersByRunId.delete(runId);
    settler(outcome);
    return true;
  }
}
