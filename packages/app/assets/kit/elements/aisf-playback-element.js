import { buildElement } from '../support/dom.js';
import { buildView, foldableModules, parsePlayback } from '../support/playback-data.js';
import { layoutPlayback } from '../support/playback-layout.js';
import { routeWires } from '../support/playback-route.js';
import { figureSvg, flaggedClass, markedClass, svgElement, TEXT_SIZE } from '../support/svg.js';

/**
 * @typedef {import('../support/playback-data.js').PlaybackData} PlaybackData
 * @typedef {import('../support/playback-data.js').ViewCriterion} ViewCriterion
 * @typedef {import('../support/playback-data.js').ViewStep} ViewStep
 * @typedef {import('../support/playback-layout.js').PlaybackLayout} PlaybackLayout
 * @typedef {import('../support/playback-route.js').RoutedWire} RoutedWire
 */

const DEFAULT_WIDTH = 1440;
const ALL = 'All';
const VIA_NAMES = { facade: 'facade', event: 'event bus', http: 'http' };
const ARROW_HEADS = ['aisf-pb-head', 'aisf-pb-head-b', 'aisf-pb-head-hot'];

export class AisfPlaybackElement extends HTMLElement {
  /** @type {string[]} */
  static observedAttributes = [];

  constructor() {
    super();
    /** @type {{ data: PlaybackData } | { error: string } | undefined} */
    this.parsed = undefined;
    /** @type {Set<string>} */
    this.folded = new Set();
    this.selected = ALL;
    /** @type {string | null} */
    this.pinned = null;
    /** @type {string | null} */
    this.hovered = null;
    this.width = 0;
    /** @type {ResizeObserver | undefined} */
    this.observer = undefined;
  }

  connectedCallback() {
    this.parsed = parsePlayback(this);
    if ('data' in this.parsed) {
      this.folded = foldableModules(this.parsed.data);
      this.selected = Object.keys(this.parsed.data.criteria)[0] ?? ALL;
    }
    this.addEventListener('click', this.onClick);
    this.addEventListener('pointerover', this.onOver);
    this.addEventListener('pointerout', this.onOut);
    this.addEventListener('keydown', this.onKey);
    this.renderAnimated();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => {
        if (this.clientWidth > 0 && this.clientWidth !== this.width) this.render();
      });
      this.observer.observe(this);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('pointerover', this.onOver);
    this.removeEventListener('pointerout', this.onOut);
    this.removeEventListener('keydown', this.onKey);
    this.observer?.disconnect();
  }

  /** Internal. Draws, then plays the selected wires in. */
  renderAnimated() {
    this.render();
    if (!this.hasSelectedCriterion()) return;
    this.querySelector('.aisf-pb-wires')?.setAttribute('data-drawing', '');
  }

  /** Internal. Draws the controls, the map, the route sheet and the readout. */
  render() {
    const parsed = this.parsed;
    if (parsed === undefined) return;
    this.width = this.clientWidth;
    const width = this.width > 0 ? this.width : DEFAULT_WIDTH;
    const old = this.querySelector(':scope > .aisf-pb');
    const root = buildElement('div', 'aisf-pb');
    if ('error' in parsed) {
      root.append(errorFigure(parsed.error));
    } else {
      this.drawMap(root, parsed.data, width);
    }
    if (old === null) this.append(root);
    else old.replaceWith(root);
    this.applyFocus();
  }

  /**
   * @param {HTMLElement} root
   * @param {PlaybackData} data
   * @param {number} width
   */
  drawMap(root, data, width) {
    const view = buildView(data, this.folded);
    const layout = layoutPlayback(data, { width, folded: this.folded });
    const criterion = view.find((entry) => entry.key === this.selected);
    const steps = (criterion === undefined ? view : [criterion]).flatMap((entry) => entry.steps);
    const wired = steps.filter((step) => step.flag === null);
    const routed = routeWires(
      layout,
      wired.map((step) => ({ key: stepId(step), from: step.from, to: step.to })),
    );
    root.append(this.controls(view), this.criterionText(view));
    const map = buildElement('div', 'aisf-pb-map');
    map.append(drawFigure(layout, view, criterion, routed, wired));
    root.append(map, this.routeSheet(data, view, criterion));
    root.append(this.readout(view, criterion, wired, layout));
  }

  hasSelectedCriterion() {
    return (
      this.parsed !== undefined &&
      'data' in this.parsed &&
      this.selected in this.parsed.data.criteria
    );
  }

  /** @param {ViewCriterion[]} view */
  controls(view) {
    const bar = buildElement('div', 'aisf-pb-controls');
    const switches = buildElement('div', 'aisf-pb-switches');
    switches.setAttribute('role', 'group');
    switches.setAttribute('aria-label', 'Path to show');
    for (const key of [...view.map((entry) => entry.key), ALL]) {
      const button = buildElement('button', 'aisf-switch', key);
      button.type = 'button';
      button.dataset['key'] = key;
      button.setAttribute('aria-pressed', String(key === this.selected));
      switches.append(button);
    }
    const legend = buildElement('div', 'aisf-pb-key');
    legend.setAttribute('aria-label', 'Key');
    legend.append(
      buildElement('span', 'aisf-pb-key-new', 'new'),
      buildElement('span', 'aisf-pb-key-changed', 'changed'),
      buildElement('span', 'aisf-pb-key-unchanged', 'unchanged'),
      buildElement('span', 'aisf-pb-key-removed', 'removed'),
    );
    bar.append(switches, legend);
    return bar;
  }

  /** @param {ViewCriterion[]} view */
  criterionText(view) {
    const holder = buildElement('div', 'aisf-pb-criterion');
    holder.setAttribute('aria-live', 'polite');
    const chosen = view.find((entry) => entry.key === this.selected);
    for (const entry of chosen === undefined ? view : [chosen]) {
      const row = buildElement('p', 'aisf-pb-criterion-row');
      row.append(
        buildElement('span', 'aisf-pb-criterion-key', entry.key),
        buildElement('span', 'aisf-pb-criterion-text', entry.title),
      );
      holder.append(row);
    }
    return holder;
  }

  /**
   * @param {PlaybackData} data
   * @param {ViewCriterion[]} view
   * @param {ViewCriterion | undefined} criterion
   */
  routeSheet(data, view, criterion) {
    const sheet = buildElement('ol', 'aisf-pb-route');
    if (criterion === undefined) {
      sheet.append(
        buildElement(
          'li',
          'aisf-pb-route-all',
          `Pick ${view.map((entry) => entry.key).join(', ')} to read one path step by step. Badges show which criteria call each function.`,
        ),
      );
      return sheet;
    }
    const names = refNames(data);
    const sources = refSources(data);
    for (const path of criterion.paths) {
      if (path.run !== '') {
        const head = buildElement('li', 'aisf-pb-route-head');
        head.dataset['run'] = path.run;
        head.append(
          buildElement('span', 'aisf-pb-route-path', `Path ${path.run}`),
          ` starts at ${path.actor}${path.start === '' ? '' : ` · ${path.start}`}`,
        );
        sheet.append(head);
      }
      for (const step of path.steps) sheet.append(stepRow(step, names, sources));
      const end = buildElement('li', 'aisf-pb-step aisf-pb-step-end');
      end.append(buildElement('span', ''), buildElement('span', 'aisf-stop', path.end.text));
      sheet.append(end);
    }
    return sheet;
  }

  /**
   * @param {ViewCriterion[]} view
   * @param {ViewCriterion | undefined} criterion
   * @param {ViewStep[]} wired
   * @param {PlaybackLayout} layout
   */
  readout(view, criterion, wired, layout) {
    const holder = buildElement('div', 'aisf-pb-foot');
    const output = buildElement('output', 'aisf-readout');
    const total = layout.boxes.reduce((sum, box) => sum + box.blocks.length, 0);
    const drawn = new Set(wired.map((step) => step.to)).size;
    if (criterion === undefined) {
      const paths = view.reduce((sum, entry) => sum + entry.paths.length, 0);
      output.textContent = `${view.length} criteria · ${paths} paths · ${wired.length} steps · ${drawn} of ${total} function blocks`;
    } else {
      const count = criterion.paths.length;
      output.textContent = `${criterion.key}: ${count} ${count === 1 ? 'path' : 'paths'} · ${wired.length} steps · ${drawn} of ${total} function blocks`;
    }
    holder.append(output);
    return holder;
  }

  /** @param {Event} event */
  onClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const choice = target.closest('.aisf-switch[data-key]');
    if (choice instanceof HTMLElement && this.contains(choice)) {
      this.selected = choice.dataset['key'] ?? ALL;
      this.pinned = null;
      this.hovered = null;
      this.renderAnimated();
      return;
    }
    const fold = target.closest('[data-fold]');
    if (fold instanceof Element && this.contains(fold)) {
      this.toggleFold(fold.getAttribute('data-fold') ?? '');
      return;
    }
    const hit = target.closest('[data-fn], [data-hit]');
    if (hit instanceof Element && this.contains(hit)) {
      this.pin(tokenOf(hit));
      return;
    }
    if (target.closest('.aisf-pb-map') !== null) this.pin(null);
  };

  /** @param {Event} event */
  onOver = (event) => {
    if (!(event instanceof PointerEvent) || event.pointerType !== 'mouse') return;
    const token = this.tokenAt(event.target);
    if (token !== null && token !== this.hovered) {
      this.hovered = token;
      this.applyFocus();
    }
  };

  /** @param {Event} event */
  onOut = (event) => {
    if (!(event instanceof PointerEvent) || event.pointerType !== 'mouse') return;
    if (this.hovered !== null && this.tokenAt(event.relatedTarget) !== this.hovered) {
      this.hovered = null;
      this.applyFocus();
    }
  };

  /** @param {Event} event */
  onKey = (event) => {
    if (!(event instanceof KeyboardEvent) || (event.key !== 'Enter' && event.key !== ' ')) return;
    const target = event.target;
    if (target instanceof Element && target.matches('[data-fn], [data-fold]')) {
      event.preventDefault();
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  };

  /** @param {EventTarget | null} target */
  tokenAt(target) {
    if (!(target instanceof Element)) return null;
    const hit = target.closest('[data-fn], [data-hit]');
    return hit instanceof Element && this.contains(hit) ? tokenOf(hit) : null;
  }

  /** @param {string | null} token */
  pin(token) {
    this.pinned = token === null || this.pinned === token ? null : token;
    this.hovered = null;
    this.applyFocus();
  }

  /** @param {string} moduleId */
  toggleFold(moduleId) {
    if (this.folded.has(moduleId)) this.folded.delete(moduleId);
    else this.folded.add(moduleId);
    this.pinned = null;
    this.hovered = null;
    this.render();
  }

  /** Internal. Lights one block or wire, its neighbours, and their route rows. */
  applyFocus() {
    const token = this.pinned ?? this.hovered;
    /** @type {Set<string>} */
    const near = new Set();
    /** @type {Set<string>} */
    const neighbours = new Set();
    let focusRef = '';
    const wires = [...this.querySelectorAll('.aisf-pb-wire')];
    if (token?.startsWith('wire:') === true) {
      const wire = wires.find((entry) => entry.getAttribute('data-step') === token.slice(5));
      if (wire !== undefined) {
        near.add(token.slice(5));
        for (const ref of [wire.getAttribute('data-from'), wire.getAttribute('data-to')])
          if (ref !== null && ref !== '') neighbours.add(ref);
      }
    } else if (token?.startsWith('fn:') === true) {
      focusRef = token.slice(3);
      for (const wire of wires) {
        const from = wire.getAttribute('data-from');
        const to = wire.getAttribute('data-to');
        if (from !== focusRef && to !== focusRef) continue;
        near.add(wire.getAttribute('data-step') ?? '');
        for (const ref of [from, to]) if (ref !== null && ref !== '') neighbours.add(ref);
      }
    }
    neighbours.delete(focusRef);
    const active = near.size > 0;
    const map = this.querySelector('.aisf-pb-map');
    map?.toggleAttribute('data-focus', active);
    this.querySelector('.aisf-pb-route')?.toggleAttribute('data-focus', active);
    for (const block of this.querySelectorAll('[data-fn]')) {
      const ref = block.getAttribute('data-fn') ?? '';
      block.toggleAttribute('data-focus', active && ref === focusRef);
      block.toggleAttribute('data-near', active && neighbours.has(ref));
      block.setAttribute('aria-pressed', String(this.pinned === `fn:${ref}`));
    }
    for (const node of this.querySelectorAll(
      '.aisf-pb-wire, .aisf-pb-start, .aisf-pb-start-label, .aisf-pb-step[data-step]',
    ))
      node.toggleAttribute('data-near', active && near.has(node.getAttribute('data-step') ?? ''));
  }
}

/** @param {ViewStep} step */
function stepId(step) {
  return `${step.criterion}:${step.num}`;
}

/** @param {Element} node */
function tokenOf(node) {
  const ref = node.getAttribute('data-fn');
  return ref === null ? `wire:${node.getAttribute('data-hit') ?? ''}` : `fn:${ref}`;
}

/** @param {PlaybackData} data @returns {Map<string, string>} */
function refSources(data) {
  /** @type {Map<string, string>} */
  const found = new Map();
  for (const playbackClass of data.classes)
    for (const fn of playbackClass.fns)
      if (fn.source !== undefined && fn.source !== '')
        found.set(`${playbackClass.id}.${fn.id}`, fn.source);
  return found;
}

/** @param {PlaybackData} data @returns {Map<string, string>} */
function refNames(data) {
  /** @type {Map<string, string>} */
  const names = new Map();
  for (const playbackClass of data.classes)
    for (const fn of playbackClass.fns)
      names.set(`${playbackClass.id}.${fn.id}`, `${playbackClass.name}.${fn.sig}`);
  for (const module of data.modules)
    names.set(`fold:${module.id}.in`, `${module.name ?? module.id} (folded)`);
  return names;
}

/**
 * @param {ViewStep} step
 * @param {Map<string, string>} names
 * @param {Map<string, string>} sources
 */
function stepRow(step, names, sources) {
  const row = buildElement('li', 'aisf-pb-step');
  row.tabIndex = 0;
  row.dataset['step'] = stepId(step);
  if (step.flag !== null) {
    row.className = flaggedClass(row.className);
    row.title = step.flag;
    row.dataset['flagged'] = '';
  }
  const hop = buildElement('span', 'aisf-pb-step-hop');
  const from = step.from === null ? step.actor : (names.get(step.from) ?? step.from);
  hop.append(from, buildElement('span', 'aisf-pb-sep', ' → '), names.get(step.to) ?? step.to);
  const badge = buildElement('span', 'aisf-pb-badge', step.num);
  if (step.run !== '') badge.dataset['run'] = step.run;
  const call = buildElement('span', 'aisf-pb-step-call', step.call);
  const via = VIA_NAMES[/** @type {keyof typeof VIA_NAMES} */ (step.via)];
  if (via !== undefined) call.append(buildElement('span', 'aisf-pb-via', via));
  if (step.folded > 0)
    call.append(buildElement('span', 'aisf-pb-via', `folded · ${step.folded} steps`));
  row.append(badge, hop, call);
  const source = sources.get(step.to);
  if (source !== undefined) row.append(buildElement('span', 'aisf-pb-step-source', source));
  return row;
}

/**
 * @param {string} message
 */
function errorFigure(message) {
  const width = Math.max(320, message.length * 8 + 40);
  const shape = svgElement('rect', {
    class: flaggedClass('aisf-shape aisf-pb-error'),
    x: 8,
    y: 8,
    width: width - 16,
    height: 44,
    rx: 6,
  });
  const reason = svgElement('title');
  reason.textContent = message;
  shape.append(reason);
  const label = textAt(20, 36, message, 'aisf-pb-text aisf-pb-error-text');
  const svg = figureSvg(width, 60, 'Playback map: the data could not be read', [shape, label]);
  svg.setAttribute('data-error', '');
  return svg;
}

/**
 * A start-anchored text in the kit's size.
 * @param {number} x
 * @param {number} y
 * @param {string} content
 * @param {string} className
 */
function textAt(x, y, content, className) {
  const node = svgElement('text', { class: className, x, y });
  node.style.fontSize = `${TEXT_SIZE}px`;
  node.textContent = content;
  return node;
}

/**
 * @param {PlaybackLayout} layout
 * @param {ViewCriterion[]} view
 * @param {ViewCriterion | undefined} criterion
 * @param {RoutedWire[]} routed
 * @param {ViewStep[]} wired
 */
function drawFigure(layout, view, criterion, routed, wired) {
  const parts = [
    svgElement(
      'defs',
      {},
      ARROW_HEADS.map((name) => marker(name)),
    ),
  ];
  for (const entry of layout.axis) {
    parts.push(
      textAt(entry.x, entry.y, entry.label, 'aisf-pb-axis'),
      svgElement('line', {
        class: 'aisf-gridline',
        x1: entry.x,
        y1: entry.y - 20,
        x2: entry.x2,
        y2: entry.y - 20,
      }),
    );
  }
  for (const module of layout.modules) parts.push(drawModule(module));
  for (const screen of layout.screens) parts.push(drawScreen(screen));
  for (const box of layout.boxes) parts.push(drawBox(box));
  const byId = new Map(wired.map((step) => [stepId(step), step]));
  const targets = new Set(
    wired.flatMap((step) => [step.to, ...(step.from === null ? [] : [step.from])]),
  );
  const ends = criterion === undefined ? [] : criterion.paths.map((path) => path.end);
  for (const end of ends) if (end.ref !== null) targets.add(end.ref);
  const wires = svgElement('g', { class: 'aisf-pb-wires' });
  const routesByKey = new Map(routed.map((entry) => [entry.key, entry]));
  wired.forEach((step, index) => {
    const route = routesByKey.get(stepId(step));
    if (route !== undefined) wires.append(...drawWire(step, route, index));
  });
  parts.push(wires);
  parts.push(...drawBadges(layout, view, criterion, byId, ends));
  for (const route of routed) {
    const step = byId.get(route.key);
    if (step === undefined) continue;
    const hit = svgElement('path', { class: 'aisf-pb-hit', d: pathData(route.points) });
    hit.setAttribute('data-hit', stepId(step));
    parts.push(hit);
  }
  const svg = figureSvg(layout.width, layout.height, 'Playback map', parts);
  svg.setAttribute('class', 'aisf-computed aisf-pb-svg');
  for (const block of svg.querySelectorAll('[data-fn]'))
    block.toggleAttribute('data-off', !targets.has(block.getAttribute('data-fn') ?? ''));
  return svg;
}

/** @param {string} id */
function marker(id) {
  return svgElement(
    'marker',
    {
      id,
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 9,
      markerHeight: 9,
      markerUnits: 'userSpaceOnUse',
      orient: 'auto',
    },
    [svgElement('path', { d: 'M0 0 L10 5 L0 10 z', class: id })],
  );
}

/** @param {import('../support/playback-layout.js').LayoutModule} module */
function drawModule(module) {
  const group = svgElement('g', {
    class: 'aisf-pb-module',
    'data-module': module.id,
    ...(module.folded ? { 'data-folded': '' } : {}),
  });
  group.append(
    svgElement('rect', {
      class: 'aisf-pb-module-frame',
      x: module.x,
      y: module.y,
      width: module.w,
      height: module.h,
      rx: 6,
    }),
    textAt(module.x + 16, module.nameBase, module.name, 'aisf-pb-module-name'),
  );
  const tag = textAt(module.x + module.w - 16, module.nameBase, module.tag, 'aisf-pb-module-tag');
  tag.setAttribute('text-anchor', 'end');
  group.append(tag);
  if (module.foldable) {
    const toggle = svgElement('g', {
      class: 'aisf-pb-fold-toggle',
      'data-fold': module.id,
      role: 'button',
      tabindex: 0,
      'aria-expanded': String(!module.folded),
    });
    const label = module.folded ? 'unfold' : 'fold';
    const word = textAt(
      module.x + 16 + (module.name.length + 1) * 8.4,
      module.nameBase,
      label,
      'aisf-pb-fold-word',
    );
    toggle.append(word);
    group.append(toggle);
  }
  module.noteLines.forEach((line, index) =>
    group.append(textAt(module.x + 16, module.noteBase[index] ?? 0, line, 'aisf-pb-note')),
  );
  return group;
}

/** @param {import('../support/playback-layout.js').LayoutScreen} screen */
function drawScreen(screen) {
  const group = svgElement('g', { class: 'aisf-pb-screen', 'data-screen': screen.id });
  group.append(
    svgElement('rect', {
      class: 'aisf-pb-screen-frame',
      x: screen.x,
      y: screen.y,
      width: screen.w,
      height: screen.h,
      rx: 4,
    }),
  );
  screen.headLines.forEach((line, index) =>
    group.append(
      textAt(
        screen.x + 10,
        screen.headBase[index] ?? 0,
        line,
        index === 0 ? 'aisf-pb-screen-name' : 'aisf-pb-screen-role',
      ),
    ),
  );
  return group;
}

/** @param {import('../support/playback-layout.js').LayoutBox} box */
function drawBox(box) {
  const shapeClass = markedClass('aisf-shape aisf-pb-box-shape', box.mark);
  const group = svgElement('g', {
    class: box.mark === 'removed' ? 'aisf-pb-box aisf-shape-removed' : 'aisf-pb-box',
    'data-class': box.id,
    'data-module': box.moduleId,
  });
  if (box.fold) group.setAttribute('data-fold', box.moduleId);
  group.append(
    svgElement('rect', {
      class: shapeClass,
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      rx: 6,
    }),
  );
  box.fileLines.forEach((line, index) =>
    group.append(textAt(box.x + 10, box.fileBase[index] ?? 0, line, 'aisf-pb-file')),
  );
  box.nameLines.forEach((line, index) =>
    group.append(textAt(box.x + 10, box.nameBase[index] ?? 0, line, 'aisf-pb-class-name')),
  );
  group.append(textAt(box.x + 10, box.kindBase, box.kindText, 'aisf-pb-kind'));
  box.blocks.forEach((block, index) => {
    const blockAbove = box.blocks[index - 1];
    if (blockAbove !== undefined) group.append(drawBlockSeparator(blockAbove, block));
    group.append(drawBlock(block));
  });
  return group;
}

/**
 * @param {import('../support/playback-layout.js').LayoutBlock} blockAbove
 * @param {import('../support/playback-layout.js').LayoutBlock} blockBelow
 */
function drawBlockSeparator(blockAbove, blockBelow) {
  const gapMiddleY = (blockAbove.y + blockAbove.h + blockBelow.y) / 2;
  return svgElement('line', {
    class: 'aisf-pb-block-sep',
    x1: blockBelow.x,
    y1: gapMiddleY,
    x2: blockBelow.x + blockBelow.w,
    y2: gapMiddleY,
  });
}

/** @param {import('../support/playback-layout.js').LayoutBlock} block */
function drawBlock(block) {
  const flagged = block.flag !== null;
  const shapeClass = `aisf-shape aisf-pb-block-shape aisf-shape-${block.mark}`;
  const group = svgElement('g', {
    class: `aisf-pb-block${block.mark === 'untouched' ? ' aisf-pb-block-muted' : ''}`,
    'data-fn': block.ref,
    role: 'button',
    tabindex: 0,
    'aria-pressed': 'false',
  });
  if (flagged) group.setAttribute('class', flaggedClass(group.getAttribute('class') ?? ''));
  const rect = svgElement('rect', {
    class: flagged ? flaggedClass(shapeClass) : shapeClass,
    x: block.x,
    y: block.y,
    width: block.w,
    height: block.h,
  });
  group.append(rect);
  if (block.flag !== null) {
    const reason = svgElement('title');
    reason.textContent = block.flag;
    group.append(reason);
  }
  block.sigLines.forEach((line, index) =>
    group.append(textAt(block.x + 10, block.sigBase[index] ?? 0, line, 'aisf-pb-sig')),
  );
  group.append(
    textAt(block.x + 10, block.metaBase, block.markLabel, 'aisf-pb-mark'),
    svgElement('line', {
      class: 'aisf-pb-divider',
      x1: block.x + 8,
      y1: block.dividerY,
      x2: block.x + block.w - 8,
      y2: block.dividerY,
    }),
  );
  block.doesLines.forEach((line, index) =>
    group.append(textAt(block.x + 10, block.doesBase[index] ?? 0, line, 'aisf-pb-does')),
  );
  return group;
}

/**
 * Step badges (or criterion keys on "All") at the right of each target block's meta line.
 * @param {PlaybackLayout} layout
 * @param {ViewCriterion[]} view
 * @param {ViewCriterion | undefined} criterion
 * @param {Map<string, ViewStep>} wiredById
 * @param {Array<{ ref: string | null, text: string }>} ends
 */
function drawBadges(layout, view, criterion, wiredById, ends) {
  /** @type {SVGElement[]} */
  const parts = [];
  const steps = [...wiredById.values()];
  for (const box of layout.boxes) {
    for (const block of box.blocks) {
      /** @type {Array<{ text: string, run: string }>} */
      const labels =
        criterion === undefined
          ? view
              .filter((entry) =>
                steps.some((step) => step.criterion === entry.key && step.to === block.ref),
              )
              .map((entry) => ({ text: entry.key, run: '' }))
          : steps
              .filter((step) => step.to === block.ref)
              .map((step) => ({ text: step.num, run: step.run }));
      let right = block.x + block.w - 10;
      for (const label of labels.reverse()) {
        const width = Math.max(20, 10 + label.text.length * 8);
        const group = svgElement('g', { class: 'aisf-pb-badge-mark', 'data-for': block.ref });
        if (label.run !== '') group.setAttribute('data-run', label.run);
        group.append(
          svgElement('rect', {
            x: right - width,
            y: block.metaBase - 15,
            width,
            height: 20,
            rx: 10,
          }),
        );
        const text = textAt(right - width / 2, block.metaBase, label.text, 'aisf-pb-badge-text');
        text.setAttribute('text-anchor', 'middle');
        group.append(text);
        parts.push(group);
        right -= width + 4;
      }
      const stop = ends.find((end) => end.ref === block.ref);
      if (stop !== undefined) {
        const mark = svgElement('rect', {
          class: 'aisf-pb-end',
          x: block.x + block.w - 18,
          y: block.y + block.h - 18,
          width: 10,
          height: 10,
        });
        const title = svgElement('title');
        title.textContent = stop.text;
        mark.append(title);
        parts.push(mark);
      }
    }
  }
  return parts;
}

/** @param {Array<{ x: number, y: number }>} points */
function pathData(points) {
  const first = points[0];
  if (first === undefined) return '';
  let commands = `M${first.x} ${first.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const before = /** @type {{ x: number, y: number }} */ (points[index - 1]);
    const here = /** @type {{ x: number, y: number }} */ (points[index]);
    const after = /** @type {{ x: number, y: number }} */ (points[index + 1]);
    const radius = Math.min(
      4,
      Math.hypot(here.x - before.x, here.y - before.y) / 2,
      Math.hypot(after.x - here.x, after.y - here.y) / 2,
    );
    if (radius < 0.5) {
      commands += ` L${here.x} ${here.y}`;
      continue;
    }
    const inX = here.x - Math.sign(here.x - before.x) * radius;
    const inY = here.y - Math.sign(here.y - before.y) * radius;
    const outX = here.x + Math.sign(after.x - here.x) * radius;
    const outY = here.y + Math.sign(after.y - here.y) * radius;
    commands += ` L${inX} ${inY} Q${here.x} ${here.y} ${outX} ${outY}`;
  }
  const last = /** @type {{ x: number, y: number }} */ (points[points.length - 1]);
  return `${commands} L${last.x} ${last.y}`;
}

/**
 * @param {ViewStep} step
 * @param {RoutedWire} route
 * @param {number} index
 */
function drawWire(step, route, index) {
  const wire = svgElement('path', {
    class: 'aisf-pb-wire',
    d: pathData(route.points),
    'data-criterion': step.criterion,
    'data-step': stepId(step),
    'data-from': step.from ?? '',
    'data-to': step.to,
  });
  if (step.run !== '') wire.setAttribute('data-run', step.run);
  if (step.via === 'event') wire.setAttribute('data-kind', 'event');
  wire.style.setProperty('--i', String(index));
  const length =
    'getTotalLength' in wire && typeof wire.getTotalLength === 'function'
      ? Math.ceil(Number(wire.getTotalLength()))
      : 0;
  wire.style.setProperty('--len', String(length));
  const parts = [wire];
  const first = route.points[0];
  if (step.from === null && first !== undefined) {
    const dot = svgElement('circle', {
      class: 'aisf-pb-start',
      cx: first.x,
      cy: first.y,
      r: 4,
      'data-step': stepId(step),
    });
    if (step.run !== '') dot.setAttribute('data-run', step.run);
    parts.push(dot);
    if (step.run !== '') {
      const label = textAt(first.x - 4, first.y - 10, step.run, 'aisf-pb-start-label');
      label.setAttribute('data-step', stepId(step));
      label.setAttribute('data-run', step.run);
      parts.push(label);
    }
  }
  return parts;
}
