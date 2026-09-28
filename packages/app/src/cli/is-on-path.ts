import { findOnPath } from './find-on-path.js';

export function isOnPath(command: string): boolean {
  return findOnPath(command) !== undefined;
}
