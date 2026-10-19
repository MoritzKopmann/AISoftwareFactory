import type { UsageReader, UsageReading } from '../business/port/sdk/usage-reader.js';

export class FakeUsageReader implements UsageReader {
  reads = 0;
  private result: Promise<UsageReading> = Promise.resolve({ fiveHour: null, sevenDay: null });

  returns(reading: UsageReading): void {
    this.result = Promise.resolve(reading);
  }

  fails(error: Error): void {
    this.result = Promise.reject(error);
    this.result.catch(() => {});
  }

  /** The next reads wait until the returned function is called with a reading. */
  hangs(): (reading: UsageReading) => void {
    let release: (reading: UsageReading) => void = () => {};
    this.result = new Promise((resolve) => {
      release = resolve;
    });
    return release;
  }

  read(): Promise<UsageReading> {
    this.reads += 1;
    return this.result;
  }
}
