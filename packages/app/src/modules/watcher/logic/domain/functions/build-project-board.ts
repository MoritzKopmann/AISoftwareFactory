import type { ProjectBoard } from '../types/project-board.js';
import type { RepositoryWatch } from '../types/repository-watch.js';
import { arrangeBoard } from './arrange-board.js';

export function buildProjectBoard(watch: RepositoryWatch): ProjectBoard {
  return {
    projectId: watch.projectId,
    sync: watch.sync,
    ...(watch.snapshot === undefined ? {} : { board: arrangeBoard(watch.snapshot) }),
  };
}
