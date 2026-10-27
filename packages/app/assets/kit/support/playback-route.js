// Pure wire routing for <aisf-playback>: A* on a 10px grid. Boxes are walls.
// A wire leaves the right edge of its source block and enters the left edge of its target block.

/**
 * @typedef {import('./playback-layout.js').PlaybackLayout} PlaybackLayout
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ key: string, from: string | null, to: string }} WireRequest
 * @typedef {{ key: string, from: string | null, to: string, points: Point[], clash: boolean }} RoutedWire
 */

export const GRID = 10;
const BOX_MARGIN = 5;
const BEND_COST = 8;
const CROSS_COST = 4;
const SOFT_COST = 6;
const CLASH_COST = 600;
const SLOT_TOP = 12;
const SLOT_BOTTOM = 6;
const COLUMN_STEPS = [1, 0, -1, 0];
const ROW_STEPS = [0, 1, 0, -1];
const DIRECTION_COUNT = 4;
const FAR_BELOW = 1e6;
const MODULE_HEAD_HEIGHT = 30;
const HEAD_MARGIN = 2;
const EDGE_MARGIN = 6;
/** How far left of its block an entry wire starts. */
export const ENTRY_RUN = 30;

/** A binary min-heap of `[cost, state]`. */
class Heap {
  constructor() {
    /** @type {Array<[number, number]>} */
    this.items = [];
  }

  /** @param {number} cost @param {number} state */
  push(cost, state) {
    const items = this.items;
    items.push([cost, state]);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const here = /** @type {[number, number]} */ (items[index]);
      const above = /** @type {[number, number]} */ (items[parent]);
      if (above[0] <= here[0]) break;
      items[parent] = here;
      items[index] = above;
      index = parent;
    }
  }

  /** @returns {[number, number]} */
  pop() {
    const items = this.items;
    const top = /** @type {[number, number]} */ (items[0]);
    const last = /** @type {[number, number]} */ (items.pop());
    if (items.length > 0) {
      items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && cost(items, left) < cost(items, smallest)) smallest = left;
        if (right < items.length && cost(items, right) < cost(items, smallest)) smallest = right;
        if (smallest === index) break;
        const swap = /** @type {[number, number]} */ (items[smallest]);
        items[smallest] = /** @type {[number, number]} */ (items[index]);
        items[index] = swap;
        index = smallest;
      }
    }
    return top;
  }

  get size() {
    return this.items.length;
  }
}

/** @param {Array<[number, number]>} items @param {number} index */
function cost(items, index) {
  return /** @type {[number, number]} */ (items[index])[0];
}

/**
 * Every block of a layout by ref, with its box.
 * @param {PlaybackLayout} layout
 */
export function blocksByRef(layout) {
  /** @type {Map<string, { block: import('./playback-layout.js').LayoutBlock, box: import('./playback-layout.js').LayoutBox }>} */
  const found = new Map();
  for (const box of layout.boxes)
    for (const block of box.blocks) found.set(block.ref, { block, box });
  return found;
}

/**
 * Routes every wire. A wire to or from a ref that is not drawn is left out.
 * @param {PlaybackLayout} layout
 * @param {WireRequest[]} requests
 * @returns {RoutedWire[]}
 */
export function routeWires(layout, requests) {
  const columnCount = Math.floor(layout.width / GRID) + 1;
  const rowCount = Math.floor(layout.height / GRID) + 1;
  const cellIndex = (/** @type {number} */ column, /** @type {number} */ row) =>
    row * columnCount + column;
  const blocked = new Uint8Array(columnCount * rowCount);
  const soft = new Uint8Array(columnCount * rowCount);
  const horizontalTaken = new Uint8Array(columnCount * rowCount);
  const verticalTaken = new Uint8Array(columnCount * rowCount);
  const owner = new Int32Array(columnCount * rowCount).fill(-1);
  const refs = blocksByRef(layout);

  /** @param {{ x: number, y: number, w: number, h: number }} rect @param {number} pad @param {Uint8Array} grid */
  const fill = (rect, pad, grid) => {
    const firstColumn = Math.max(0, Math.ceil((rect.x - pad) / GRID));
    const lastColumn = Math.min(columnCount - 1, Math.floor((rect.x + rect.w + pad) / GRID));
    const firstRow = Math.max(0, Math.ceil((rect.y - pad) / GRID));
    const lastRow = Math.min(rowCount - 1, Math.floor((rect.y + rect.h + pad) / GRID));
    for (let row = firstRow; row <= lastRow; row += 1)
      for (let column = firstColumn; column <= lastColumn; column += 1)
        grid[cellIndex(column, row)] = 1;
  };
  for (const box of layout.boxes) fill(box, BOX_MARGIN, blocked);
  for (const module of layout.modules) {
    fill({ x: module.x, y: module.y, w: module.w, h: MODULE_HEAD_HEIGHT }, HEAD_MARGIN, soft);
    for (const edge of [
      { x: module.x, y: module.y, w: 0, h: module.h },
      { x: module.x + module.w, y: module.y, w: 0, h: module.h },
    ])
      fill(edge, EDGE_MARGIN, soft);
  }
  for (const screen of layout.screens)
    fill({ x: screen.x, y: screen.y, w: screen.w, h: MODULE_HEAD_HEIGHT }, HEAD_MARGIN, soft);

  /** @type {Array<{ index: number, request: WireRequest, outY?: number, inY?: number, begin?: Point, end: Point, start?: { column: number, row: number }, goal: { column: number, row: number }, points: Point[], clash: boolean }>} */
  const wires = [];
  for (const request of requests) {
    const target = refs.get(request.to);
    const source = request.from === null ? undefined : refs.get(request.from);
    if (target === undefined || (request.from !== null && source === undefined)) continue;
    wires.push({
      index: wires.length,
      request,
      end: { x: target.block.x, y: 0 },
      goal: { column: 0, row: 0 },
      points: [],
      clash: false,
    });
  }

  const slotLines = (/** @type {string} */ ref) => {
    const found = /** @type {NonNullable<ReturnType<typeof refs.get>>} */ (refs.get(ref));
    const { block } = found;
    const lines = [];
    for (
      let y = Math.ceil((block.y + SLOT_TOP) / GRID) * GRID;
      y <= block.y + block.h - SLOT_BOTTOM;
      y += GRID
    )
      lines.push(y);
    return lines.length > 0 ? lines : [Math.round((block.y + block.h / 2) / GRID) * GRID];
  };
  const centreY = (/** @type {string} */ ref) => {
    const { block } = /** @type {NonNullable<ReturnType<typeof refs.get>>} */ (refs.get(ref));
    return block.y + block.h / 2;
  };
  const group = (/** @type {(wire: (typeof wires)[number]) => string | null} */ pick) => {
    /** @type {Map<string, typeof wires>} */
    const groups = new Map();
    for (const wire of wires) {
      const key = pick(wire);
      if (key === null) continue;
      const members = groups.get(key) ?? [];
      members.push(wire);
      groups.set(key, members);
    }
    return groups;
  };
  const lastOf = (/** @type {number[]} */ list, /** @type {number} */ position) =>
    /** @type {number} */ (list[Math.min(list.length - 1, position)]);
  for (const [ref, members] of group((wire) => wire.request.from)) {
    // Calls upward take the top slots, calls downward the lower ones: a fan-out nests.
    const here = centreY(ref);
    const rank = (/** @type {(typeof wires)[number]} */ wire) => {
      const y = centreY(wire.request.to);
      return y < here ? y : FAR_BELOW - y;
    };
    members.sort((first, second) => rank(first) - rank(second));
    const lines = slotLines(ref);
    const offset = Math.max(0, Math.floor((lines.length - members.length) / 2) - 1);
    members.forEach((wire, position) => (wire.outY = lastOf(lines, position + offset)));
  }
  for (const [ref, members] of group((wire) => wire.request.to)) {
    members.sort(
      (first, second) =>
        (first.request.from === null ? -1 : centreY(first.request.from)) -
        (second.request.from === null ? -1 : centreY(second.request.from)),
    );
    const lines = slotLines(ref);
    members.forEach((wire, position) => (wire.inY = lastOf(lines, position)));
  }
  for (const wire of wires) {
    const target = /** @type {NonNullable<ReturnType<typeof refs.get>>} */ (
      refs.get(wire.request.to)
    );
    const inY = wire.inY ?? 0;
    wire.end = { x: target.block.x, y: inY };
    wire.goal = {
      column: Math.floor((target.block.x - BOX_MARGIN - 0.01) / GRID),
      row: inY / GRID,
    };
    if (wire.request.from !== null) {
      const source = /** @type {NonNullable<ReturnType<typeof refs.get>>} */ (
        refs.get(wire.request.from)
      );
      const outY = wire.outY ?? 0;
      wire.begin = { x: source.block.x + source.block.w, y: outY };
      wire.start = {
        column: Math.ceil((source.block.x + source.block.w + BOX_MARGIN + 0.01) / GRID),
        row: outY / GRID,
      };
    }
  }

  const portCells = (/** @type {(typeof wires)[number]} */ wire) => [
    cellIndex(wire.goal.column, wire.goal.row),
    cellIndex(wire.goal.column - 1, wire.goal.row),
    ...(wire.start === undefined
      ? []
      : [
          cellIndex(wire.start.column, wire.start.row),
          cellIndex(wire.start.column + 1, wire.start.row),
        ]),
  ];
  const ports = new Set();
  for (const wire of wires)
    for (const cell of portCells(wire)) {
      owner[cell] = wire.index;
      ports.add(cell);
    }

  const occupy = (
    /** @type {Array<{ column: number, row: number }>} */ cells,
    /** @type {number} */ index,
  ) => {
    for (let position = 1; position < cells.length; position += 1) {
      const from = /** @type {{ column: number, row: number }} */ (cells[position - 1]);
      const to = /** @type {{ column: number, row: number }} */ (cells[position]);
      const isHorizontal = from.row === to.row;
      const length = Math.max(Math.abs(to.column - from.column), Math.abs(to.row - from.row));
      for (let offset = 0; offset <= length; offset += 1) {
        const cell = cellIndex(
          from.column + Math.sign(to.column - from.column) * offset,
          from.row + Math.sign(to.row - from.row) * offset,
        );
        (isHorizontal ? horizontalTaken : verticalTaken)[cell] = 1;
        owner[cell] = index;
      }
    }
    for (let position = 1; position < cells.length - 1; position += 1) {
      const corner = /** @type {{ column: number, row: number }} */ (cells[position]);
      horizontalTaken[cellIndex(corner.column, corner.row)] = 1;
      verticalTaken[cellIndex(corner.column, corner.row)] = 1;
    }
  };

  const search = (/** @type {(typeof wires)[number]} */ wire) => {
    const start = /** @type {{ column: number, row: number }} */ (wire.start);
    const { goal } = wire;
    const best = new Float64Array(columnCount * rowCount * DIRECTION_COUNT).fill(Infinity);
    const previous = new Int32Array(columnCount * rowCount * DIRECTION_COUNT).fill(-1);
    const closed = new Uint8Array(columnCount * rowCount * DIRECTION_COUNT);
    const heap = new Heap();
    const first = cellIndex(start.column, start.row) * DIRECTION_COUNT;
    best[first] = 0;
    heap.push(0, first);
    let found = -1;
    while (heap.size > 0) {
      const [, state] = heap.pop();
      if (closed[state] === 1) continue;
      closed[state] = 1;
      const cell = state >> 2;
      const direction = state & 3;
      const column = cell % columnCount;
      const row = (cell - column) / columnCount;
      if (column === goal.column && row === goal.row && direction === 0) {
        found = state;
        break;
      }
      const spent = /** @type {number} */ (best[state]);
      for (let next = 0; next < DIRECTION_COUNT; next += 1) {
        if (next === (direction + 2) % DIRECTION_COUNT) continue;
        const nextColumn = column + /** @type {number} */ (COLUMN_STEPS[next]);
        const nextRow = row + /** @type {number} */ (ROW_STEPS[next]);
        if (nextColumn < 0 || nextRow < 0 || nextColumn >= columnCount || nextRow >= rowCount)
          continue;
        const target = cellIndex(nextColumn, nextRow);
        if (blocked[target] === 1 && !ports.has(target)) continue;
        if (blocked[target] === 1 && owner[target] !== wire.index) continue;
        let step = 1 + (soft[target] ?? 0) * SOFT_COST;
        if (next !== direction) {
          step += BEND_COST;
          if (
            (horizontalTaken[cell] === 1 || verticalTaken[cell] === 1) &&
            !(column === start.column && row === start.row)
          )
            step += CLASH_COST;
        }
        const horizontal = next % 2 === 0;
        if ((horizontal ? horizontalTaken : verticalTaken)[target] === 1) step += CLASH_COST;
        else if ((horizontal ? verticalTaken : horizontalTaken)[target] === 1) step += CROSS_COST;
        if (ports.has(target) && owner[target] !== wire.index) step += CLASH_COST;
        // The last run into a block is straight: arrive at the goal moving right.
        if (nextColumn === goal.column && nextRow === goal.row && next !== 0) step += CLASH_COST;
        const nextState = target * DIRECTION_COUNT + next;
        const total = spent + step;
        if (total < /** @type {number} */ (best[nextState])) {
          best[nextState] = total;
          previous[nextState] = state;
          heap.push(
            total + Math.abs(nextColumn - goal.column) + Math.abs(nextRow - goal.row),
            nextState,
          );
        }
      }
    }
    if (found < 0) return null;
    /** @type {Array<{ column: number, row: number }>} */
    const cells = [];
    for (let state = found; state >= 0; state = /** @type {number} */ (previous[state])) {
      const cell = state >> 2;
      cells.push({ column: cell % columnCount, row: Math.floor(cell / columnCount) });
    }
    cells.reverse();
    return { cells, cost: /** @type {number} */ (best[found]) };
  };

  const corners = (/** @type {Array<{ column: number, row: number }>} */ cells) =>
    cells.filter((cell, position) => {
      if (position === 0 || position === cells.length - 1) return true;
      const before = /** @type {{ column: number, row: number }} */ (cells[position - 1]);
      const after = /** @type {{ column: number, row: number }} */ (cells[position + 1]);
      const isStraightColumn = before.column === cell.column && cell.column === after.column;
      const isStraightRow = before.row === cell.row && cell.row === after.row;
      return !(isStraightColumn || isStraightRow);
    });

  const span = (/** @type {(typeof wires)[number]} */ wire) =>
    wire.start === undefined
      ? 0
      : Math.abs(wire.start.column - wire.goal.column) + Math.abs(wire.start.row - wire.goal.row);
  // Short wires first: they have the fewest ways round.
  for (const wire of [...wires].sort((first, second) => span(first) - span(second))) {
    if (wire.start === undefined || wire.begin === undefined) {
      const dot = { x: wire.end.x - ENTRY_RUN, y: wire.end.y };
      occupy(
        [
          { column: Math.floor(dot.x / GRID), row: wire.goal.row },
          { column: wire.goal.column, row: wire.goal.row },
        ],
        wire.index,
      );
      wire.points = [dot, wire.end];
      continue;
    }
    const found = search(wire);
    if (found === null) {
      wire.clash = true;
      wire.points = [wire.begin, wire.end];
      continue;
    }
    wire.clash = found.cost >= CLASH_COST;
    const turns = corners(found.cells);
    occupy(turns, wire.index);
    wire.points = [
      wire.begin,
      ...turns.map((cell) => ({ x: cell.column * GRID, y: cell.row * GRID })),
      wire.end,
    ];
  }
  return wires.map((wire) => ({
    key: wire.request.key,
    from: wire.request.from,
    to: wire.request.to,
    points: wire.points,
    clash: wire.clash,
  }));
}
