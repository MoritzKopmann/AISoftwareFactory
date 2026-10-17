import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FakeCommandLabeler,
  FakeCommandLabelRepository,
} from '../../testing/fake-agent-runs-ports.js';
import { CommandLabelFailedError } from '../errors/command-label-failed-error.js';
import { CommandLabelService } from './command-label-service.js';

function hashOf(command: string): string {
  return createHash('sha256').update(command).digest('hex');
}

describe('CommandLabelService', () => {
  let commandLabelRepository: FakeCommandLabelRepository;

  beforeEach(() => {
    commandLabelRepository = new FakeCommandLabelRepository();
  });

  function serviceWith(commandLabeler: FakeCommandLabeler): CommandLabelService {
    return new CommandLabelService({ commandLabelRepository, commandLabeler });
  }

  describe('labelFor', () => {
    it('should label and store the command when it is new', async () => {
      const commandLabeler = new FakeCommandLabeler('Runs the test suite.');

      const label = await serviceWith(commandLabeler).labelFor('npm test');

      expect(label).toBe('Runs the test suite.');
      expect(commandLabeler.commands).toEqual(['npm test']);
      expect(commandLabelRepository.labelsByHash.get(hashOf('npm test'))).toBe(
        'Runs the test suite.',
      );
    });

    it('should return the stored label without a call when one exists', async () => {
      commandLabelRepository.labelsByHash.set(hashOf('npm test'), 'Stored.');
      const commandLabeler = new FakeCommandLabeler('Other.');

      const label = await serviceWith(commandLabeler).labelFor('npm test');

      expect(label).toBe('Stored.');
      expect(commandLabeler.commands).toEqual([]);
    });

    it('should share one call when the same command is requested while pending', async () => {
      let answer: (text: string) => void = () => undefined;
      const commandLabeler = new FakeCommandLabeler(
        new Promise<string>((resolve) => {
          answer = resolve;
        }),
      );
      const service = serviceWith(commandLabeler);

      const first = service.labelFor('npm test');
      const second = service.labelFor('npm test');
      await Promise.resolve();
      answer('Runs the tests.');

      expect(await first).toBe('Runs the tests.');
      expect(await second).toBe('Runs the tests.');
      expect(commandLabeler.commands).toEqual(['npm test']);
    });

    it('should keep the first line, trimmed, when the answer has several', async () => {
      const commandLabeler = new FakeCommandLabeler('  Runs the tests.\nExtra line');

      const label = await serviceWith(commandLabeler).labelFor('npm test');

      expect(label).toBe('Runs the tests.');
      expect(commandLabelRepository.labelsByHash.get(hashOf('npm test'))).toBe('Runs the tests.');
    });

    it('should cut the label to 70 chars when the answer is longer', async () => {
      const answer = 'x'.repeat(150);
      const commandLabeler = new FakeCommandLabeler(answer);

      const label = await serviceWith(commandLabeler).labelFor('npm test');

      expect(label).toBe('x'.repeat(70));
      expect(commandLabelRepository.labelsByHash.get(hashOf('npm test'))).toBe('x'.repeat(70));
    });

    it('should store nothing and retry on the next call when the labeler rejects', async () => {
      const commandLabeler = new FakeCommandLabeler(
        new CommandLabelFailedError('timeout'),
        'Runs the tests.',
      );
      const service = serviceWith(commandLabeler);

      const first = await service.labelFor('npm test');
      expect(first).toBeUndefined();
      expect(commandLabelRepository.labelsByHash.size).toBe(0);

      const second = await service.labelFor('npm test');
      expect(second).toBe('Runs the tests.');
      expect(commandLabeler.commands).toHaveLength(2);
    });

    it('should return undefined and store nothing when the answer is blank', async () => {
      const commandLabeler = new FakeCommandLabeler('   ');

      const label = await serviceWith(commandLabeler).labelFor('npm test');

      expect(label).toBeUndefined();
      expect(commandLabelRepository.labelsByHash.size).toBe(0);
    });
  });

  describe('storedLabelFor', () => {
    it('should return undefined without a call when nothing is stored', async () => {
      const commandLabeler = new FakeCommandLabeler('Never.');

      const label = await serviceWith(commandLabeler).storedLabelFor('npm test');

      expect(label).toBeUndefined();
      expect(commandLabeler.commands).toEqual([]);
    });

    it('should return the stored label when one exists', async () => {
      commandLabelRepository.labelsByHash.set(hashOf('npm test'), 'Stored.');

      const label = await serviceWith(new FakeCommandLabeler()).storedLabelFor('npm test');

      expect(label).toBe('Stored.');
    });
  });
});
