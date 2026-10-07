import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { buildLayout } from './src/layout.js';

const directory = dirname(fileURLToPath(import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(join(directory, 'src', name), 'utf8'));

const layout = buildLayout(readJson('graph.json'), readJson('review.json'));
const segments = layout.edges.flatMap((edge) =>
  edge.points.slice(1).map((end, index) => ({ edgeId: edge.id, start: edge.points[index], end })),
);
const isVertical = (segment) => Math.abs(segment.start.x - segment.end.x) < 0.01;
const spansOverlap = (firstFrom, firstTo, secondFrom, secondTo) =>
  Math.min(Math.max(firstFrom, firstTo), Math.max(secondFrom, secondTo)) -
    Math.max(Math.min(firstFrom, firstTo), Math.min(secondFrom, secondTo)) >
  0.5;

const overlaps = [];
for (const [index, first] of segments.entries()) {
  for (const second of segments.slice(index + 1)) {
    if (first.edgeId === second.edgeId || isVertical(first) !== isVertical(second)) continue;
    const [axis, along] = isVertical(first) ? ['x', 'y'] : ['y', 'x'];
    if (
      Math.abs(first.start[axis] - second.start[axis]) < 3 &&
      spansOverlap(first.start[along], first.end[along], second.start[along], second.end[along])
    ) {
      overlaps.push(`${first.edgeId} / ${second.edgeId}`);
    }
  }
}
console.log(
  `Sheet ${Math.round(layout.width)} x ${Math.round(layout.height)}, ` +
    `${layout.edges.length} lines, ${overlaps.length} overlapping segments`,
);

const builtPagePath = resolve(process.argv[2] ?? join(tmpdir(), 'aisf-module-map.html'));
const html = readFileSync(builtPagePath, 'utf8');
const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'dangerously' });
const scriptErrors = [];
dom.window.addEventListener('error', (event) => scriptErrors.push(event.message));
const { document } = dom.window;
console.log(
  `Page: ${document.querySelectorAll('.box').length} boxes, ` +
    `${document.querySelectorAll('path.edge').length} lines, ` +
    `${document.querySelectorAll('.domain').length} domains, ${scriptErrors.length} script errors`,
);

process.exitCode = overlaps.length > 0 || scriptErrors.length > 0 ? 1 : 0;
