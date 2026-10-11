import type { BoardRow } from './board-row.js';

export type BoardView = {
  readonly rows: ReadonlyArray<BoardRow>;
};
