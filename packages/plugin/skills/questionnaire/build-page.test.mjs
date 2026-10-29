import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'build-page.mjs');
const PAGE_ID = 'plan-7';

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
  spawnSync('node', [script, PAGE_ID, String(roundNumber)], {
    cwd: root,
    encoding: 'utf8',
  });
const page = () => readFileSync(join(planDirectory, 'index.html'), 'utf8');
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'build-page-'));
  planDirectory = join(root, '.aisf', 'artifacts', PAGE_ID);
  write('questions/ac1.html', card('ac1'));
  write('questions/q-a.html', card('q-a'));
  write('questions/q-b.html', card('q-b'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('build-page', () => {
  it('should write the shell with the page id as title and no header when header.html is absent', () => {
    round(1, ['ac1']);

    const result = run(1);

    const html = page();
    expect(result.status).toBe(0);
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain('<title>plan-7</title>');
    expect(html).toContain('<aisf-round number="1">');
    expect(html).toContain('<aisf-question name="ac1"');
    expect(html).not.toContain('<aisf-precedent>');
    expect(html).not.toContain('aisf-header');
    expect(html).not.toContain('<aisf-playback>');
  });

  it('should hold the new header once and rounds 1 and 2 when header.html changes between rounds', () => {
    write('header.html', '<p>old header</p>');
    round(1, ['ac1']);
    run(1);
    write('header.html', '<p>new header</p>');
    round(2, ['q-a']);

    const result = run(2);

    const html = page();
    expect(result.status).toBe(0);
    expect(html.match(/new header/g)).toHaveLength(1);
    expect(html).not.toContain('old header');
    expect(html.indexOf('new header')).toBeLessThan(html.indexOf('<aisf-round number="1">'));
    expect(html).toContain('<aisf-round number="1">');
    expect(html).toContain('<aisf-round number="2">');
  });

  it('should drop the header when header.html is removed before a later round', () => {
    write('header.html', '<p>a header</p>');
    round(1, ['ac1']);
    run(1);
    rmSync(join(planDirectory, 'header.html'));
    round(2, ['q-a']);

    run(2);

    expect(page()).not.toContain('a header');
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

  it('should exit 1 and write nothing when round-1.json is missing', () => {
    const result = run(1);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('round-1.json');
  });

  it('should exit 1 and keep the page when it lacks </body>', () => {
    write('index.html', '<html></html>');
    round(1, ['ac1']);

    const result = run(1);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('</body>');
    expect(page()).toBe('<html></html>');
  });

  describe('confirm round', () => {
    const confirm = (roundNumber, tasks) =>
      write(`round-${roundNumber}.json`, JSON.stringify({ confirm: { tasks } }));

    it('should render one task each with blocked-by and hitl when the round holds confirm.tasks', () => {
      confirm(3, [
        { number: 1, heading: 'First', blockedBy: [], hitl: false },
        { number: 2, heading: 'Second', blockedBy: [1, 4], hitl: true },
      ]);

      const result = run(3);

      const html = page();
      const tasks = html.match(/<aisf-task[^>]*>/g);
      expect(result.status).toBe(0);
      expect(html).toContain('<aisf-round number="3">');
      expect(html.match(/<aisf-confirm>/g)).toHaveLength(1);
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).not.toContain('blocked-by');
      expect(tasks[0]).not.toContain('hitl');
      expect(tasks[1]).toContain('blocked-by="1, 4"');
      expect(tasks[1]).toContain('hitl');
    });

    it('should escape & " and < in the heading when a task heading holds them', () => {
      confirm(3, [{ number: 1, heading: 'A & "B" <C>', blockedBy: [], hitl: false }]);

      run(3);

      const html = page();
      expect(html).toContain('heading="A &amp; &quot;B&quot; &lt;C>"');
      expect(html.match(/<aisf-task/g)).toHaveLength(1);
    });

    it('should put the summary inside the round above the confirm element when confirm.summary is set', () => {
      write('summary.html', '<p>the summary</p>');
      write('round-3.json', JSON.stringify({ confirm: { tasks: [], summary: 'summary.html' } }));

      const result = run(3);

      const html = page();
      const roundHtml = html.slice(html.indexOf('<aisf-round number="3">'));
      expect(result.status).toBe(0);
      expect(roundHtml.indexOf('<p>the summary</p>')).toBeGreaterThan(0);
      expect(roundHtml.indexOf('<p>the summary</p>')).toBeLessThan(
        roundHtml.indexOf('<aisf-confirm>'),
      );
      expect(roundHtml.indexOf('<aisf-confirm>')).toBeLessThan(roundHtml.indexOf('</aisf-round>'));
    });

    it('should exit 1 naming the file and write nothing when confirm.summary is missing', () => {
      write('round-3.json', JSON.stringify({ confirm: { tasks: [], summary: 'gone.html' } }));

      const result = run(3);

      expect(result.status).toBe(1);
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(result.stdout).toContain('gone.html');
      expect(() => page()).toThrow();
    });

    it('should exit 1 naming the mix and write nothing when the round holds confirm and cards', () => {
      write('round-4.json', JSON.stringify({ confirm: { tasks: [] }, cards: ['ac1'] }));

      const result = run(4);

      expect(result.status).toBe(1);
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
      expect(result.stdout).toContain('confirm');
      expect(() => page()).toThrow();
    });
  });
});
