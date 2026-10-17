import { createHash } from 'node:crypto';
import { CommandLabelFailedError } from '../errors/command-label-failed-error.js';
import type { CommandLabeler } from '../port/label/command-labeler.js';
import type { CommandLabelRepository } from '../port/repository/command-label-repository.js';

const MAX_LABEL_LENGTH = 70;

export type CommandLabelServiceDependencies = {
  readonly commandLabelRepository: CommandLabelRepository;
  readonly commandLabeler: CommandLabeler;
};

function commandHashOf(command: string): string {
  return createHash('sha256').update(command).digest('hex');
}

function cleanLabel(answer: string): string {
  return (answer.trim().split('\n')[0] ?? '').trim().slice(0, MAX_LABEL_LENGTH);
}

/** Looks up, generates and stores the short label of a command. */
export class CommandLabelService {
  private readonly pendingByHash = new Map<string, Promise<string | undefined>>();

  constructor(private readonly dependencies: CommandLabelServiceDependencies) {}

  storedLabelFor(command: string): Promise<string | undefined> {
    return this.dependencies.commandLabelRepository.findByCommandHash(commandHashOf(command));
  }

  async labelFor(command: string): Promise<string | undefined> {
    const commandHash = commandHashOf(command);
    const stored = await this.dependencies.commandLabelRepository.findByCommandHash(commandHash);
    if (stored !== undefined) {
      return stored;
    }
    const pending = this.pendingByHash.get(commandHash);
    if (pending !== undefined) {
      return pending;
    }
    const generation = this.generate(command, commandHash).finally(() => {
      this.pendingByHash.delete(commandHash);
    });
    this.pendingByHash.set(commandHash, generation);
    return generation;
  }

  private async generate(command: string, commandHash: string): Promise<string | undefined> {
    const { commandLabeler, commandLabelRepository } = this.dependencies;
    try {
      const label = cleanLabel(await commandLabeler.label(command));
      if (label === '') {
        return undefined;
      }
      await commandLabelRepository.insert(commandHash, label);
      return label;
    } catch (error) {
      if (!(error instanceof CommandLabelFailedError)) throw error;
      return undefined;
    }
  }
}
