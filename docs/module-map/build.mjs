import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(process.argv[2] ?? join(tmpdir(), 'aisf-module-map.html'));
const read = (name) => readFileSync(join(directory, 'src', name), 'utf8');
const compactJson = (name) => JSON.stringify(JSON.parse(read(name)));

const layoutScript = read('layout.js').replace(
  'export function buildLayout',
  'function buildLayout',
);
const page = read('page-template.html')
  .replace('/*LAYOUT*/', () => layoutScript)
  .replace('/*GRAPH*/', () => compactJson('graph.json'))
  .replace('/*REVIEW*/', () => compactJson('review.json'));

writeFileSync(outputPath, page);
console.log(`Wrote ${outputPath} (${page.length} characters)`);
