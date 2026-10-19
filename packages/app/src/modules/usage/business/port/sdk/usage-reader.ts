import type { WindowObservation } from '../../domain/types/window-observation.js';

export type UsageReading = Pick<WindowObservation, 'fiveHour' | 'sevenDay'>;

export interface UsageReader {
  /** Reads the account's usage windows. A window the source does not report is null. Throws `UsageReadFailedError`. */
  read(): Promise<UsageReading>;
}
