import type { AisfEventMap } from './aisf-event-map.js';

type EventName = keyof AisfEventMap;

// Resolves to the names the list forgot; a non-empty union makes the list fail to compile.
type ListedNames<List extends ReadonlyArray<EventName>> = List[number];
type RequireEveryName<List extends ReadonlyArray<EventName>> = [
  Exclude<EventName, ListedNames<List>>,
] extends [never]
  ? List
  : never;

function listEveryName<const List extends ReadonlyArray<EventName>>(
  names: RequireEveryName<List>,
): List {
  return names as unknown as List;
}

/** Every AisfEventMap key at runtime. The type checker rejects a missing or an extra name. */
export const aisfEventNames = listEveryName([
  'project.added',
  'snapshot.changed',
  'run.started',
  'run.step-added',
  'run.waiting',
  'run.wait-cleared',
  'run.finished',
  'ticket.status-written',
  'finding.changed',
  'artifact.published',
  'watch.updated',
  'skills.status-changed',
]);
