import { randomUUID } from 'node:crypto';
import type { Identifiers } from '../../logic/ports/identifiers.js';

export class RandomUuidIdentifiers implements Identifiers {
  next(): string {
    return randomUUID();
  }
}
