export interface RunSettlement {
  settle(runId: string): Promise<void>;
}
