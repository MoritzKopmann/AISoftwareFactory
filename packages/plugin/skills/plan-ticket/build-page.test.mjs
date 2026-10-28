import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'build-page.mjs');
const TICKET_NUMBER = 7;

let root;
let planDirectory;

const card = (name) => `<aisf-question name="${name}" heading="${name}?"></aisf-question>\n`;
const write = (file, text) => {
  mkdirSync(dirname(join(planDirectory, file)), { recursive: true });
  writeFileSync(join(planDirectory, file), text);
};
const round = (roundNumber, cards, rows = []) =>
  write(`round-${roundNumber}.json`, JSON.stringify({ cards, rows }));
const run = (roundNumber) =>
  spawnSync('node', [script, String(TICKET_NUMBER), String(roundNumber)], {
    cwd: root,
    encoding: 'utf8',
  });
const page = () => readFileSync(join(planDirectory, 'index.html'), 'utf8');
const playbackJson = (html) => {
  const match = /<aisf-playback>\s*<script type="application\/json">([\s\S]*?)<\/script>/.exec(
    html,
  );
  return match[1];
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'build-page-'));
  planDirectory = join(root, '.aisf', 'artifacts', `plan-${TICKET_NUMBER}`);
  write('end-state.html', '<p>The end state.</p>');
  write('playback.json', JSON.stringify({ modules: [] }));
  write('questions/ac1.html', card('ac1'));
  write('questions/q-a.html', card('q-a'));
  write('questions/q-b.html', card('q-b'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('build-page', () => {
  it('should write the full shell when no page exists', () => {
    round(1, ['ac1']);

    const result = run(1);

    const html = page();
    expect(result.status).toBe(0);
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain('<title>Plan 7</title>');
    expect(html).toContain('<span class="label">End state</span>');
    expect(html).toContain('<p>The end state.</p>');
    expect(html).toContain('<aisf-playback>');
    expect(html).toContain('<aisf-round number="1">');
    expect(html).toContain('<aisf-question name="ac1"');
    expect(html).not.toContain('<aisf-precedent>');
  });

  it('should append the round after earlier rounds when the page has rounds 1 and 2', () => {
    round(1, ['ac1']);
    run(1);
    round(2, ['q-a']);
    run(2);
    const before = page();
    round(3, ['q-b', 'q-a'], ['<div name="r1">one</div>', '<div name="r2">two</div>']);

    const result = run(3);

    const html = page();
    const round1 = before.slice(before.indexOf('<aisf-round number="1">'));
    expect(html).toContain(round1.slice(0, round1.indexOf('</aisf-round>')));
    expect(html.indexOf('number="1"')).toBeLessThan(html.indexOf('number="2"'));
    expect(html.indexOf('number="2"')).toBeLessThan(html.indexOf('number="3"'));
    const round3 = html.slice(html.indexOf('<aisf-round number="3">'));
    expect(round3.indexOf('name="q-b"')).toBeLessThan(round3.indexOf('name="q-a"'));
    expect(round3.indexOf('name="q-a"')).toBeLessThan(round3.indexOf('<aisf-precedent>'));
    expect(round3).toContain('<div name="r1">one</div>');
    expect(round3).toContain('<div name="r2">two</div>');
    expect(html.match(/<aisf-precedent>/g)).toHaveLength(1);
    expect(result.stdout.trim()).toBe(
      'page: .aisf/artifacts/plan-7/index.html · round 3 · 2 cards · 2 rows',
    );
  });

  it('should keep one round 3 with the new cards when it reruns', () => {
    round(3, ['q-a']);
    run(3);
    round(3, ['q-b']);

    const result = run(3);

    const html = page();
    expect(result.status).toBe(0);
    expect(html.match(/<aisf-round number="3">/g)).toHaveLength(1);
    expect(html).toContain('name="q-b"');
    expect(html).not.toContain('name="q-a"');
  });

  it('should keep the playback object and escape < when a does text holds </script>', () => {
    const data = { modules: [{ id: 'm', does: 'ends </script> early' }] };
    write('playback.json', JSON.stringify(data));
    round(1, ['ac1']);

    run(1);

    const json = playbackJson(page());
    expect(JSON.parse(json)).toEqual(data);
    expect(json).not.toContain('<');
  });

  it('should refresh the playback JSON when the page exists and playback changed', () => {
    round(1, ['ac1']);
    run(1);
    write('playback.json', JSON.stringify({ modules: [{ id: 'new' }] }));
    round(2, ['q-a']);

    run(2);

    expect(JSON.parse(playbackJson(page()))).toEqual({ modules: [{ id: 'new' }] });
  });

  it.each([
    ['is missing', undefined],
    ['does not start with <aisf-question', '<p>nope</p>'],
  ])(
    'should exit 1 naming the card and keep the page when a card file %s',
    (situation, content) => {
      round(1, ['ac1']);
      run(1);
      const before = page();
      if (content !== undefined) write('questions/bad.html', content);
      round(2, ['bad']);

      const result = run(2);

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain('bad');
      expect(page()).toBe(before);
    },
  );

  it('should exit 1 and write nothing when round-TICKET_NUMBER.json is missing', () => {
    const result = run(1);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('round-1.json');
  });

  it('should exit 1 and write nothing when playback.json is unparsable', () => {
    round(1, ['ac1']);
    write('playback.json', '{nope');

    const result = run(1);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('playback.json');
    expect(() => page()).toThrow();
  });

  it.each([
    ['<aisf-playback>', '<html><body></body></html>'],
    ['</body>', '<aisf-playback><script type="application/json">{}</script></aisf-playback>'],
  ])('should exit 1 and keep the page when it lacks %s', (missing, html) => {
    write('index.html', html);
    round(1, ['ac1']);

    const result = run(1);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(missing);
    expect(page()).toBe(html);
  });

  it('should exit 1 when the page is missing and end-state.html is missing', () => {
    rmSync(join(planDirectory, 'end-state.html'));
    round(1, ['ac1']);

    const result = run(1);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('end-state.html');
  });
});
