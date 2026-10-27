// Pure layout for <aisf-playback>: columns, rows, boxes, blocks and the fold. No DOM.
import {
  callsInside,
  FOLD_PREFIX,
  fnFlag,
  foldableModules,
  foldRef,
  LAYERS,
} from './playback-data.js';

/**
 * @typedef {import('./playback-data.js').PlaybackData} PlaybackData
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {Rect & { ref: string, mark: string, markLabel: string, flag: string | null, pending: string | null, sigLines: string[], doesLines: string[], sigBase: number[], metaBase: number, dividerY: number, doesBase: number[] }} LayoutBlock
 * @typedef {Rect & { id: string, moduleId: string, screenId: string | null, mark: string, markLabel: string, fold: boolean, fileLines: string[], nameLines: string[], kindText: string, fileBase: number[], nameBase: number[], kindBase: number, blocks: LayoutBlock[] }} LayoutBox
 * @typedef {Rect & { id: string, name: string, tag: string, mark: string, note: string, noteLines: string[], bus: boolean, frontend: boolean, folded: boolean, foldable: boolean, nameBase: number, noteBase: number[] }} LayoutModule
 * @typedef {Rect & { id: string, moduleId: string, file: string, role: string, mark: string, tag: string, headLines: string[], headBase: number[] }} LayoutScreen
 * @typedef {{ label: string, x: number, y: number, x2: number }} LayoutAxis
 * @typedef {{ width: number, height: number, modules: LayoutModule[], screens: LayoutScreen[], boxes: LayoutBox[], axis: LayoutAxis[], bands: number }} PlaybackLayout
 */

export const CHAR_WIDTH = 7.6;
export const LINE = 17;
export const MARGIN = 24;
export const GUTTER = 64;
export const AXIS_WIDTH = 124;
export const BAND_GAP = 56;
export const MODULE_PAD = 16;
const SCREEN_PAD = 8;
const BOX_PAD_X = 10;
const BOX_GAP = 30;
const ROW_GAP = 34;
const MODULE_HEAD = 34;
const MIN_COLUMN = 150;
const TEXT_ASCENT = 13;
const MODULE_HEAD_PADDING = 48;
const WRAP_TRIES = [34, 30, 26, 22];
const BANDED_WRAP = 24;

/** @param {string} mark */
export function markLabel(mark) {
  return mark === 'untouched' ? 'unchanged' : mark;
}

/**
 * Wraps at spaces, then at word joins of identifiers; never mid-word unless there is no join.
 * @param {string} text
 * @param {number} limit characters per line
 * @returns {string[]}
 */
export function wrapText(text, limit) {
  /** @type {Array<{ word: string, glued: boolean }>} */
  const pieces = [];
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    let rest = '';
    let first = true;
    const push = (/** @type {string} */ part) => {
      pieces.push({ word: part, glued: !first });
      first = false;
    };
    for (const part of word.split(/(?<=[a-z.])(?=[A-Z])|(?<=[.(,/-])/)) {
      if (rest !== '' && rest.length + part.length > limit) {
        push(rest);
        rest = '';
      }
      rest += part;
      while (rest.length > limit) {
        push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
    }
    if (rest !== '') push(rest);
  }
  /** @type {string[]} */
  const lines = [];
  let line = '';
  for (const { word, glued } of pieces) {
    const space = line === '' || glued ? '' : ' ';
    const fits = line.length + space.length + word.length <= limit;
    if (line !== '' && !fits) {
      lines.push(line);
      line = word;
    } else {
      line += space + word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** @param {string[]} lines */
function widest(lines) {
  return Math.max(0, ...lines.map((line) => line.length)) * CHAR_WIDTH;
}

/**
 * @typedef {{ id: string, moduleId: string, screenId: string | null, layer: string | null, mark: string, fold: boolean, file: string, name: string, kind: string, fns: Array<{ ref: string, sig: string, mark: string, does: string, flag: string | null, pending: string | null }> }} Item
 */

/**
 * The boxes of a module: its classes, or one stand-in when folded.
 * @param {PlaybackData} data
 * @param {string} moduleId
 * @param {boolean} folded
 * @returns {Item[]}
 */
function itemsOf(data, moduleId, folded) {
  const module = data.modules.find((entry) => entry.id === moduleId);
  if (folded && module !== undefined) {
    const layerOf =
      data.classes.find((playbackClass) => playbackClass.module === moduleId)?.layer ??
      LAYERS[0] ??
      null;
    return [
      {
        id: `${FOLD_PREFIX}${moduleId}`,
        moduleId,
        screenId: null,
        layer: layerOf,
        mark: 'untouched',
        fold: true,
        file: module.name ?? module.id,
        name: '',
        kind: 'folded module',
        fns: [
          {
            ref: foldRef(moduleId),
            sig: module.does ?? 'existing code',
            mark: 'untouched',
            does: `Unchanged. ${callsInside(data, moduleId)} steps inside. Click to unfold.`,
            flag: null,
            pending: null,
          },
        ],
      },
    ];
  }
  return data.classes
    .filter((playbackClass) => playbackClass.module === moduleId)
    .map((playbackClass) => ({
      id: playbackClass.id,
      moduleId,
      screenId: playbackClass.screen ?? null,
      layer: playbackClass.layer,
      mark: playbackClass.mark,
      fold: false,
      file: playbackClass.file,
      name: playbackClass.name,
      kind: playbackClass.kind,
      fns: playbackClass.fns.map((fn) => ({
        ref: `${playbackClass.id}.${fn.id}`,
        sig: fn.sig,
        mark: fn.mark,
        does: fn.does,
        flag: fnFlag(fn),
        pending: fn.pending === undefined || fn.pending === '' ? null : `pending ${fn.pending}`,
      })),
    }));
}

/**
 * Box text wrapped at `limit` characters, and the width and height that follow.
 * @param {Item} item
 * @param {number} limit
 */
function measureBox(item, limit) {
  const fileLines = wrapText(item.fold ? '' : `${item.file} /`, limit);
  const nameLines = wrapText(item.fold ? item.file : item.name, limit);
  const kindText = `${item.kind} · ${markLabel(item.mark)}`;
  const headLines = (item.fold ? 0 : fileLines.length) + nameLines.length + 1;
  const blocks = item.fns.map((fn) => {
    const sigLines = wrapText(fn.sig, limit);
    const doesLines = wrapText(fn.does, limit);
    if (fn.pending !== null) doesLines.push(fn.pending);
    return { fn, sigLines, doesLines };
  });
  const width =
    2 * BOX_PAD_X +
    Math.max(
      widest(fileLines),
      widest(nameLines),
      kindText.length * CHAR_WIDTH,
      ...blocks.flatMap(({ sigLines, doesLines }) => [widest(sigLines), widest(doesLines)]),
    );
  return { fileLines: item.fold ? [] : fileLines, nameLines, kindText, headLines, blocks, width };
}

/** Block height from its line counts. */
function blockHeight(/** @type {number} */ sig, /** @type {number} */ does) {
  return 6 + sig * LINE + 24 + 6 + does * LINE + 6;
}

/**
 * @param {Item} item
 * @param {ReturnType<typeof measureBox>} measured
 */
function boxHeight(item, measured) {
  const head = 6 + measured.headLines * LINE + 8;
  return (
    head +
    measured.blocks.reduce(
      (sum, block) => sum + blockHeight(block.sigLines.length, block.doesLines.length),
      0,
    )
  );
}

/**
 * Lays the data out inside `width`: modules left to right, in bands when they do not fit.
 * @param {PlaybackData} data
 * @param {{ width: number, folded: ReadonlySet<string> }} options
 * @returns {PlaybackLayout}
 */
export function layoutPlayback(data, options) {
  const frontendFirst = [...data.modules].sort(
    (first, second) => Number(second.kind === 'frontend') - Number(first.kind === 'frontend'),
  );
  const shown = frontendFirst.filter((module) =>
    data.classes.some((playbackClass) => playbackClass.module === module.id),
  );
  const single = WRAP_TRIES.map((limit) => planBands(data, shown, options, limit)).find(
    (bands) => bands.length <= 1,
  );
  const bands = single ?? planBands(data, shown, options, BANDED_WRAP);
  return placeBands(data, bands);
}

/**
 * Sizes every module column at a wrap limit and packs the columns into bands.
 * @param {PlaybackData} data
 * @param {PlaybackData['modules']} shown
 * @param {{ width: number, folded: ReadonlySet<string> }} options
 * @param {number} limit characters per line
 */
function planBands(data, shown, options, limit) {
  const columns = shown.map((module) => {
    const folded = options.folded.has(module.id);
    const items = itemsOf(data, module.id, folded);
    const measured = items.map((item) => ({ item, measure: measureBox(item, limit) }));
    const hasScreens = items.some((item) => item.screenId !== null);
    const head =
      ((module.name ?? module.id).length + module.tag.length) * CHAR_WIDTH + MODULE_HEAD_PADDING;
    const inner = Math.max(0, ...measured.map(({ measure }) => measure.width));
    const width = Math.max(
      MIN_COLUMN,
      head,
      inner + 2 * MODULE_PAD + (hasScreens ? 2 * SCREEN_PAD : 0),
    );
    return { module, folded, measured, width };
  });
  /** @type {Array<typeof columns>} */
  const bands = [];
  let current = /** @type {typeof columns} */ ([]);
  let used = 0;
  for (const column of columns) {
    const extra = current.length === 0 ? 0 : GUTTER;
    if (
      current.length > 0 &&
      used + extra + column.width > options.width - 2 * MARGIN - AXIS_WIDTH
    ) {
      bands.push(current);
      current = [];
      used = 0;
    }
    used += (current.length === 0 ? 0 : GUTTER) + column.width;
    current.push(column);
  }
  if (current.length > 0) bands.push(current);
  return bands;
}

/**
 * @param {PlaybackData} data
 * @param {Array<{ module: PlaybackData['modules'][number], folded: boolean, measured: Array<{ item: Item, measure: ReturnType<typeof measureBox> }>, width: number }>[]} bands
 * @returns {PlaybackLayout}
 */
function placeBands(data, bands) {
  /** @type {LayoutModule[]} */
  const modules = [];
  /** @type {LayoutScreen[]} */
  const screens = [];
  /** @type {LayoutBox[]} */
  const boxes = [];
  /** @type {LayoutAxis[]} */
  const axis = [];
  let top = MARGIN;
  let totalWidth = 0;
  const foldable = foldableModules(data);
  for (const band of bands) {
    const layered = band.some(({ module }) => module.kind !== 'frontend');
    const left = MARGIN + (layered ? AXIS_WIDTH : 0);
    const rowNames = [...LAYERS];
    for (const { measured } of band)
      for (const { item } of measured)
        if (item.layer !== null && !rowNames.includes(item.layer)) rowNames.push(item.layer);
    /** @param {Item} item */
    const rowOf = (item) => (item.layer === null ? '' : item.layer);
    /** @type {Map<string, number>} */
    const rowHeights = new Map();
    let stackHeight = 0;
    for (const { module, measured, width } of band) {
      const frontend = module.kind === 'frontend';
      if (frontend) {
        stackHeight = Math.max(stackHeight, stackedHeight(data, measured, width));
        continue;
      }
      for (const name of rowNames) {
        const cell = measured.filter(({ item }) => rowOf(item) === name);
        const height = cell.reduce(
          (sum, { item, measure }, index) =>
            sum + boxHeight(item, measure) + (index === 0 ? 0 : BOX_GAP),
          0,
        );
        rowHeights.set(name, Math.max(rowHeights.get(name) ?? 0, height));
      }
    }
    const usedRows = rowNames.filter((name) => (rowHeights.get(name) ?? 0) > 0);
    const rowTop = new Map();
    let rowsHeight = 0;
    for (const name of usedRows) {
      rowTop.set(name, rowsHeight);
      rowsHeight += (rowHeights.get(name) ?? 0) + ROW_GAP;
    }
    rowsHeight = Math.max(0, rowsHeight - ROW_GAP);
    const noteLimit = (/** @type {number} */ width) =>
      Math.max(8, Math.floor((width - 2 * MODULE_PAD) / CHAR_WIDTH));
    const noteHeights = band.map(({ module, width }) =>
      module.note === undefined ? 0 : wrapText(module.note, noteLimit(width)).length * LINE + 4,
    );
    const headHeight = MODULE_HEAD + Math.max(0, ...noteHeights);
    const bodyHeight = Math.max(rowsHeight, stackHeight);
    const height = headHeight + MODULE_PAD + bodyHeight + MODULE_PAD;
    let x = left;
    for (const { module, folded, measured, width } of band) {
      const frontend = module.kind === 'frontend';
      const note = module.note ?? '';
      const noteLines = note === '' ? [] : wrapText(note, noteLimit(width));
      modules.push({
        id: module.id,
        name: module.name ?? module.id,
        tag: module.tag,
        mark: module.mark,
        note,
        noteLines,
        bus: module.bus === true,
        frontend,
        folded,
        foldable: foldable.has(module.id),
        x,
        y: top,
        w: width,
        h: height,
        nameBase: top + 21,
        noteBase: noteLines.map((_, index) => top + MODULE_HEAD + 8 + index * LINE),
      });
      const bodyTop = top + headHeight + MODULE_PAD;
      if (frontend) {
        placeStack(data, measured, x, bodyTop, width, { boxes, screens, moduleId: module.id });
      } else {
        for (const name of usedRows) {
          const cell = measured.filter(({ item }) => rowOf(item) === name);
          let y = bodyTop + (rowTop.get(name) ?? 0);
          for (const { item, measure } of cell) {
            const box = placeBox(item, measure, x + MODULE_PAD, y, width - 2 * MODULE_PAD);
            boxes.push(box);
            y += box.h + BOX_GAP;
          }
        }
      }
      x += width + GUTTER;
    }
    if (layered) {
      for (const name of usedRows) {
        const rowY = top + headHeight + MODULE_PAD + (rowTop.get(name) ?? 0);
        axis.push({ label: name, x: MARGIN, y: rowY + 14, x2: x - GUTTER });
      }
    }
    totalWidth = Math.max(totalWidth, x - GUTTER + MARGIN);
    top += height + BAND_GAP;
  }
  const height = Math.max(MARGIN * 2, top - BAND_GAP + MARGIN);
  return {
    width: Math.ceil(totalWidth),
    height,
    modules,
    screens,
    boxes,
    axis,
    bands: bands.length,
  };
}

/**
 * @param {PlaybackData} data
 * @param {Array<{ item: Item, measure: ReturnType<typeof measureBox> }>} measured
 * @param {number} width
 */
function stackedHeight(data, measured, width) {
  const groups = stackGroups(measured);
  return groups.reduce(
    (sum, group, index) =>
      sum +
      (index === 0 ? 0 : BOX_GAP) +
      (group.screen === null ? 0 : screenHead(data, group.screen, width).height + SCREEN_PAD) +
      group.entries.reduce(
        (inner, { item, measure }, position) =>
          inner + boxHeight(item, measure) + (position === 0 ? 0 : BOX_GAP),
        0,
      ) +
      (group.screen === null ? 0 : SCREEN_PAD),
    0,
  );
}

/** @param {Array<{ item: Item, measure: ReturnType<typeof measureBox> }>} measured */
function stackGroups(measured) {
  /** @type {Array<{ screen: string | null, entries: typeof measured }>} */
  const groups = [];
  for (const entry of measured) {
    const screen = entry.item.screenId;
    const last = groups[groups.length - 1];
    const same = last !== undefined && screen !== null && last.screen === screen;
    if (same) last.entries.push(entry);
    else groups.push({ screen, entries: [entry] });
  }
  return groups;
}

/**
 * The wrapped header lines of a screen frame, and how tall they make it.
 * @param {PlaybackData} data
 * @param {string} screenId
 * @param {number} columnWidth
 */
function screenHead(data, screenId, columnWidth) {
  const screen = data.screens.find((entry) => entry.id === screenId);
  const limit = Math.max(
    8,
    Math.floor((columnWidth - 2 * MODULE_PAD - 2 * SCREEN_PAD - 12) / CHAR_WIDTH),
  );
  const lines =
    screen === undefined
      ? []
      : [
          ...wrapText(screen.file, limit),
          ...wrapText(`${markLabel(screen.mark)} · ${screen.role}`, limit),
        ];
  return { lines, height: 6 + lines.length * LINE + 6 };
}

/**
 * The frontend column: screen frames and loose boxes, stacked.
 * @param {PlaybackData} data
 * @param {Array<{ item: Item, measure: ReturnType<typeof measureBox> }>} measured
 * @param {number} x
 * @param {number} top
 * @param {number} width
 * @param {{ boxes: LayoutBox[], screens: LayoutScreen[], moduleId: string }} out
 */
function placeStack(data, measured, x, top, width, out) {
  let y = top;
  for (const group of stackGroups(measured)) {
    const screen =
      group.screen === null ? undefined : data.screens.find((entry) => entry.id === group.screen);
    const inset = screen === undefined ? 0 : SCREEN_PAD;
    const frameTop = y;
    const head = screen === undefined ? undefined : screenHead(data, screen.id, width);
    if (head !== undefined) y += head.height;
    const boxWidth = width - 2 * MODULE_PAD - 2 * inset;
    for (const { item, measure } of group.entries) {
      const box = placeBox(item, measure, x + MODULE_PAD + inset, y, boxWidth);
      out.boxes.push(box);
      y += box.h + BOX_GAP;
    }
    y -= BOX_GAP;
    if (screen !== undefined) {
      y += SCREEN_PAD;
      out.screens.push({
        id: screen.id,
        moduleId: out.moduleId,
        file: screen.file,
        role: screen.role,
        mark: screen.mark,
        tag: markLabel(screen.mark),
        headLines: head?.lines ?? [],
        headBase: (head?.lines ?? []).map((_, index) => frameTop + 6 + index * LINE + TEXT_ASCENT),
        x: x + MODULE_PAD,
        y: frameTop,
        w: width - 2 * MODULE_PAD,
        h: y - frameTop,
      });
    }
    y += BOX_GAP;
  }
}

/**
 * @param {Item} item
 * @param {ReturnType<typeof measureBox>} measured
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @returns {LayoutBox}
 */
function placeBox(item, measured, x, y, width) {
  const fileBase = measured.fileLines.map((_, index) => y + 6 + index * LINE + TEXT_ASCENT);
  const nameTop = y + 6 + measured.fileLines.length * LINE;
  const nameBase = measured.nameLines.map((_, index) => nameTop + index * LINE + TEXT_ASCENT);
  const kindBase = nameTop + measured.nameLines.length * LINE + 13;
  let blockTop = y + 6 + measured.headLines * LINE + 8;
  /** @type {LayoutBlock[]} */
  const blocks = measured.blocks.map(({ fn, sigLines, doesLines }) => {
    const height = blockHeight(sigLines.length, doesLines.length);
    const metaTop = blockTop + 6 + sigLines.length * LINE;
    const dividerY = metaTop + 24;
    const block = {
      ref: fn.ref,
      x,
      y: blockTop,
      w: width,
      h: height,
      mark: fn.mark,
      markLabel: markLabel(fn.mark),
      flag: fn.flag,
      pending: fn.pending,
      sigLines,
      doesLines,
      sigBase: sigLines.map((_, index) => blockTop + 6 + index * LINE + TEXT_ASCENT),
      metaBase: metaTop + 14,
      dividerY,
      doesBase: doesLines.map((_, index) => dividerY + 6 + index * LINE + TEXT_ASCENT),
    };
    blockTop += height;
    return block;
  });
  return {
    id: item.id,
    moduleId: item.moduleId,
    screenId: item.screenId,
    x,
    y,
    w: width,
    h: blockTop - y,
    mark: item.mark,
    markLabel: markLabel(item.mark),
    fold: item.fold,
    fileLines: measured.fileLines,
    nameLines: measured.nameLines,
    kindText: measured.kindText,
    fileBase,
    nameBase,
    kindBase,
    blocks,
  };
}
