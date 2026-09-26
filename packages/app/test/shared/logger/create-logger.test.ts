import { describe, expect, it } from 'vitest';
import { createLogger, type LogLevel } from '../../../src/shared/logger/create-logger.js';

describe('createLogger', () => {
  it('should write each message to the sink with its level when logged', () => {
    const written: Array<readonly [LogLevel, string]> = [];
    const logger = createLogger((level, message) => written.push([level, message]));

    logger.info('starting');
    logger.warn('slow');
    logger.error('broken');

    expect(written).toEqual([
      ['info', 'starting'],
      ['warn', 'slow'],
      ['error', 'broken'],
    ]);
  });
});
