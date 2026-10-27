// Pure support for <aisf-playback>: read the JSON child, check it, work out flags and steps.

/**
 * @typedef {{ id: string, sig: string, mark: string, does: string, source?: string, pending?: string }} PlaybackFn
 * @typedef {{ id: string, module: string, layer: string | null, screen?: string, file: string, name: string, kind: string, mark: string, fns: PlaybackFn[] }} PlaybackClass
 * @typedef {{ id: string, name?: string, kind?: string, bus?: boolean, mark: string, tag: string, does?: string, note?: string }} PlaybackModule
 * @typedef {{ id: string, module: string, file: string, role: string, mark: string }} PlaybackScreen
 * @typedef {[string | null, string, string, (string | undefined)?]} PlaybackStep
 * @typedef {{ actor: string, label?: string, steps: PlaybackStep[], end: [string, string] }} PlaybackPath
 * @typedef {{ title: string, paths: PlaybackPath[] }} PlaybackCriterion
 * @typedef {{ modules: PlaybackModule[], screens: PlaybackScreen[], classes: PlaybackClass[], criteria: Record<string, PlaybackCriterion> }} PlaybackData
 * @typedef {{ criterion: string, run: string, actor: string, num: string, from: string | null, to: string, call: string, via: string, folded: number, flag: string | null }} ViewStep
 * @typedef {{ run: string, actor: string, start: string, steps: ViewStep[], end: { ref: string | null, text: string, flag: string | null } }} ViewPath
 * @typedef {{ key: string, title: string, paths: ViewPath[], steps: ViewStep[] }} ViewCriterion
 */

export const LAYERS = ['presentation', 'business', 'infrastructure'];

/** A folded module's stand-in block has the ref `fold:<module>.in`. */
export const FOLD_PREFIX = 'fold:';
const FIRST_RUN_CHARACTER_CODE = 65;

/**
 * Reads and checks the JSON child of `host`.
 * @param {Element} host
 * @returns {{ data: PlaybackData } | { error: string }}
 */
export function parsePlayback(host) {
  const script = host.querySelector(':scope > script[type="application/json"]');
  if (script === null) return { error: 'playback: no <script type="application/json"> child' };
  let raw;
  try {
    raw = JSON.parse(script.textContent ?? '');
  } catch (failure) {
    return { error: `playback: the JSON does not parse (${describe(failure)})` };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { error: 'playback: the JSON is not an object' };
  return { data: normalise(raw) };
}

/** @param {unknown} failure */
function describe(failure) {
  return failure instanceof Error ? failure.message : String(failure);
}

/** @param {unknown} value */
function asList(value) {
  return Array.isArray(value) ? value : [];
}

/** @param {unknown} value */
function asText(value) {
  return typeof value === 'string' ? value : '';
}

/** @param {unknown} value @returns {Record<string, any>} */
function asRecord(value) {
  return typeof value === 'object' && value !== null
    ? /** @type {Record<string, any>} */ (value)
    : {};
}

/**
 * @param {Record<string, any>} raw
 * @returns {PlaybackData}
 */
function normalise(raw) {
  return {
    modules: asList(raw['modules']).map((entry) => {
      const item = asRecord(entry);
      return {
        ...item,
        id: asText(item['id']),
        mark: asText(item['mark']),
        tag: asText(item['tag']),
      };
    }),
    screens: asList(raw['screens']).map((entry) => {
      const item = asRecord(entry);
      return {
        id: asText(item['id']),
        module: asText(item['module']),
        file: asText(item['file']),
        role: asText(item['role']),
        mark: asText(item['mark']),
      };
    }),
    classes: asList(raw['classes']).map((entry) => {
      const item = asRecord(entry);
      return {
        ...item,
        id: asText(item['id']),
        module: asText(item['module']),
        layer: typeof item['layer'] === 'string' ? item['layer'] : null,
        file: asText(item['file']),
        name: asText(item['name']),
        kind: asText(item['kind']),
        mark: asText(item['mark']),
        fns: asList(item['fns']).map((fnEntry) => {
          const fn = asRecord(fnEntry);
          return {
            ...fn,
            id: asText(fn['id']),
            sig: asText(fn['sig']),
            mark: asText(fn['mark']),
            does: asText(fn['does']),
          };
        }),
      };
    }),
    criteria: Object.fromEntries(
      Object.entries(asRecord(raw['criteria'])).map(([key, entry]) => {
        const item = asRecord(entry);
        return [
          key,
          {
            title: asText(item['title']),
            paths: asList(item['paths']).map((pathEntry) => {
              const path = asRecord(pathEntry);
              const end = asList(path['end']);
              return {
                ...path,
                actor: asText(path['actor']),
                steps: asList(path['steps']).map((step) => {
                  const parts = asList(step);
                  return [
                    typeof parts[0] === 'string' ? parts[0] : null,
                    asText(parts[1]),
                    asText(parts[2]),
                    typeof parts[3] === 'string' ? parts[3] : undefined,
                  ];
                }),
                end: [asText(end[0]), asText(end[1])],
              };
            }),
          },
        ];
      }),
    ),
  };
}

/**
 * `<class id>.<fn id>` refs of the data's functions, mapped to the function and its class.
 * @param {PlaybackData} data
 * @returns {Map<string, { fn: PlaybackFn, playbackClass: PlaybackClass }>}
 */
export function functionsByRef(data) {
  /** @type {Map<string, { fn: PlaybackFn, playbackClass: PlaybackClass }>} */
  const refs = new Map();
  for (const playbackClass of data.classes)
    for (const fn of playbackClass.fns)
      refs.set(`${playbackClass.id}.${fn.id}`, { fn, playbackClass });
  return refs;
}

/**
 * A fn that is not `new` and names no `source` is flagged; the value is the reason.
 * @param {PlaybackFn} fn
 * @returns {string | null}
 */
export function fnFlag(fn) {
  if (fn.mark === 'new' || (fn.source !== undefined && fn.source !== '')) return null;
  return `${fn.sig} is ${fn.mark}, but names no source`;
}

/**
 * Modules that start folded: layered, not the bus, and every class untouched.
 * @param {PlaybackData} data
 * @returns {Set<string>}
 */
export function foldableModules(data) {
  return new Set(
    data.modules
      .filter((module) => {
        const classes = data.classes.filter((playbackClass) => playbackClass.module === module.id);
        return (
          module.bus !== true &&
          module.kind !== 'frontend' &&
          classes.length > 0 &&
          classes.every((playbackClass) => playbackClass.mark === 'untouched')
        );
      })
      .map((module) => module.id),
  );
}

/**
 * The ref a hop is drawn to: a folded module's stand-in block, or the function itself.
 * @param {string} ref
 * @param {Map<string, { playbackClass: PlaybackClass }>} refs
 * @param {Set<string>} folded
 */
export function shownRef(ref, refs, folded) {
  const found = refs.get(ref);
  if (found === undefined || !folded.has(found.playbackClass.module)) return ref;
  return foldRef(found.playbackClass.module);
}

/** @param {string} moduleId */
export function foldRef(moduleId) {
  return `${FOLD_PREFIX}${moduleId}.in`;
}

/**
 * How many distinct calls land inside a module, across every criterion.
 * @param {PlaybackData} data
 * @param {string} moduleId
 */
export function callsInside(data, moduleId) {
  const refs = functionsByRef(data);
  const inside = (/** @type {string | null} */ ref) =>
    ref !== null && refs.get(ref)?.playbackClass.module === moduleId;
  const hops = new Set();
  for (const criterion of Object.values(data.criteria))
    for (const path of criterion.paths)
      for (const [from, to] of path.steps) if (inside(to)) hops.add(`${from}>${to}`);
  return hops.size;
}

/**
 * Every criterion's paths and steps, with folded modules collapsed into one hop.
 * Paths are lettered A, B, … when a criterion has two or more.
 * @param {PlaybackData} data
 * @param {Set<string>} folded
 * @returns {ViewCriterion[]}
 */
export function buildView(data, folded) {
  const refs = functionsByRef(data);
  return Object.entries(data.criteria).map(([key, criterion]) => {
    const many = criterion.paths.length > 1;
    /** @type {ViewPath[]} */
    const paths = criterion.paths.map((path, index) => {
      const run = many ? String.fromCharCode(FIRST_RUN_CHARACTER_CODE + index) : '';
      /** @type {ViewStep[]} */
      const steps = [];
      /** @type {Map<string, ViewStep>} */
      const lastEntry = new Map();
      let number = 0;
      for (const [rawFrom, rawTo, call, via] of path.steps) {
        const unknown = [rawFrom, rawTo].find((ref) => ref !== null && !refs.has(ref));
        const from = rawFrom === null ? null : shownRef(rawFrom, refs, folded);
        const to = shownRef(rawTo, refs, folded);
        if (from !== null && from === to) {
          const entry = lastEntry.get(to);
          if (entry !== undefined) entry.folded += 1;
          continue;
        }
        number += 1;
        const isFold = to.startsWith(FOLD_PREFIX);
        /** @type {ViewStep} */
        const step = {
          criterion: key,
          run,
          actor: path.actor,
          num: `${run}${number}`,
          from,
          to,
          call,
          via: via ?? '',
          folded: isFold ? 1 : 0,
          flag: unknown === undefined || unknown === null ? null : `unknown function ${unknown}`,
        };
        if (isFold) lastEntry.set(to, step);
        steps.push(step);
      }
      const endRef = path.end[0];
      return {
        run,
        actor: path.actor,
        start: path.label ?? '',
        steps,
        end: {
          ref: refs.has(endRef) ? shownRef(endRef, refs, folded) : null,
          text: path.end[1],
          flag: refs.has(endRef) ? null : `unknown function ${endRef}`,
        },
      };
    });
    return { key, title: criterion.title, paths, steps: paths.flatMap((path) => path.steps) };
  });
}
