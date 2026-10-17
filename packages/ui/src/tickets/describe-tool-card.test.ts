import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { describe, expect, it } from 'vitest';
import {
  describeResultParts,
  describeToolHeader,
  describeToolInput,
  describeToolRow,
  toggleOpened,
} from './describe-tool-card.js';

type Call = Extract<SessionEntryResponse, { kind: 'tool-call' }>;
type Result = Extract<SessionEntryResponse, { kind: 'tool-result' }>;

function call(name: string, input: unknown, id = 'c1'): Call {
  return { kind: 'tool-call', id, toolUseId: `use-${id}`, name, input };
}

function result(text: string, isError = false, id = 'r1', toolUseId = 'use-c1'): Result {
  return { kind: 'tool-result', id, toolUseId, isError, parts: [{ kind: 'text', text }] };
}

function lines(count: number): string {
  return Array.from({ length: count }, (_, position) => `line ${position}`).join('\n');
}

describe('describeToolRow', () => {
  it('should use the file path as a mono headline and the read tag when the tool is Read', () => {
    expect(describeToolRow(call('Read', { file_path: 'a/b.ts' }), undefined, true)).toMatchObject({
      tag: { name: 'Read', colour: 'read' },
      headline: { text: 'a/b.ts', mono: true },
    });
  });

  it('should use the pattern as the headline when the tool is Glob', () => {
    expect(describeToolRow(call('Glob', { pattern: '**/*.ts' }), undefined, true)).toMatchObject({
      tag: { name: 'Glob', colour: 'read' },
      headline: { text: '**/*.ts', mono: true },
    });
  });

  it('should quote the pattern and add the path when the tool is Grep with a path', () => {
    expect(
      describeToolRow(call('Grep', { pattern: 'foo', path: 'src' }), undefined, true).headline,
    ).toEqual({ text: '"foo" in src', mono: true });
  });

  it('should quote only the pattern when Grep has no path', () => {
    expect(describeToolRow(call('Grep', { pattern: 'foo' }), undefined, true).headline).toEqual({
      text: '"foo"',
      mono: true,
    });
  });

  it('should show the file path and the replaced text as second line when the tool is Edit', () => {
    expect(
      describeToolRow(
        call('Edit', { file_path: 'a.ts', old_string: 'x', new_string: 'y' }),
        undefined,
        true,
      ),
    ).toMatchObject({
      tag: { name: 'Edit', colour: 'edit' },
      headline: { text: 'a.ts', mono: true },
      secondLine: '"x" → "y"',
    });
  });

  it('should use the file path and no second line when the tool is Write', () => {
    const row = describeToolRow(
      call('Write', { file_path: 'a.ts', content: 'z' }),
      undefined,
      true,
    );
    expect(row).toMatchObject({ tag: { colour: 'edit' }, headline: { text: 'a.ts' } });
    expect(row.secondLine).toBeUndefined();
  });

  it('should use the description as a plain headline and the command as second line when the tool is Bash', () => {
    expect(
      describeToolRow(
        call('Bash', { description: 'Run tests', command: 'npm test' }),
        undefined,
        true,
      ),
    ).toMatchObject({
      tag: { name: 'Bash', colour: 'run' },
      headline: { text: 'Run tests', mono: false },
      secondLine: '$ npm test',
    });
  });

  it('should show Command as a plain headline and the command as second line when Bash has no label or description', () => {
    const row = describeToolRow(call('Bash', { command: 'npm test' }), undefined, true);
    expect(row.headline).toEqual({ text: 'Command', mono: false });
    expect(row.secondLine).toBe('$ npm test');
  });

  it('should show the label as a plain headline when Bash has a label', () => {
    const row = describeToolRow(
      { ...call('Bash', { command: 'npm test' }), label: 'Runs the tests.' },
      undefined,
      true,
    );
    expect(row.headline).toEqual({ text: 'Runs the tests.', mono: false });
    expect(row.secondLine).toBe('$ npm test');
  });

  it('should prefer the description over the label when Bash has both', () => {
    const row = describeToolRow(
      { ...call('Bash', { command: 'npm test', description: 'Run tests' }), label: 'Runs.' },
      undefined,
      true,
    );
    expect(row.headline).toEqual({ text: 'Run tests', mono: false });
  });

  it('should use the url as headline and the read tag when the tool is Screenshot', () => {
    expect(
      describeToolRow(call('Screenshot', { url: 'http://localhost' }), undefined, true),
    ).toMatchObject({ tag: { colour: 'read' }, headline: { text: 'http://localhost' } });
  });

  it('should show the tool name as sent and no headline when the tool is unknown', () => {
    const row = describeToolRow(call('Task', { prompt: 'x' }), undefined, true);
    expect(row.tag).toEqual({ name: 'Task', colour: 'read' });
    expect(row.headline).toBeUndefined();
  });

  it('should show no headline when the input has no usable field', () => {
    expect(describeToolRow(call('Read', 'oops'), undefined, true).headline).toBeUndefined();
  });

  it('should be running with only the input toggle when there is no result and the run is live', () => {
    const row = describeToolRow(call('Read', { file_path: 'a' }), undefined, true);
    expect(row.status).toBe('running');
    expect(row.resultToggle).toBeUndefined();
  });

  it('should have no status when there is no result and the run has ended', () => {
    expect(describeToolRow(call('Read', { file_path: 'a' }), undefined, false).status).toBe('none');
  });

  it('should be done with a Result toggle when the result is not an error', () => {
    const row = describeToolRow(call('Read', { file_path: 'a' }), result(lines(3)), true);
    expect(row.status).toBe('done');
    expect(row.resultToggle).toEqual({ label: 'Result', size: '3 lines', error: false });
  });

  it('should be failed with an Error toggle when the result is an error', () => {
    const row = describeToolRow(call('Read', { file_path: 'a' }), result('boom', true), true);
    expect(row.status).toBe('failed');
    expect(row.resultToggle).toEqual({ label: 'Error', size: '1 line', error: true });
  });

  it('should write the size with a thousands separator when the result is long', () => {
    expect(
      describeToolRow(call('Glob', { pattern: 'x' }), result(lines(2418)), true).resultToggle?.size,
    ).toBe('2,418 lines');
  });

  it('should count images and join them to the lines when the result mixes parts', () => {
    const mixed: Result = {
      ...result(''),
      parts: [
        { kind: 'text', text: 'a\nb' },
        { kind: 'image', mediaType: 'image/png', data: 'x' },
        { kind: 'image', mediaType: 'image/png', data: 'y' },
      ],
    };
    expect(describeToolRow(call('Screenshot', {}), mixed, true).resultToggle?.size).toBe(
      '2 lines · 2 images',
    );
  });

  it('should say 1 image when the result holds one image part only', () => {
    const image: Result = {
      ...result(''),
      parts: [{ kind: 'image', mediaType: 'image/png', data: 'x' }],
    };
    expect(describeToolRow(call('Screenshot', {}), image, true).resultToggle?.size).toBe('1 image');
  });

  it('should carry the keys of the two panes, one per toggle, when a call has an id', () => {
    const row = describeToolRow(call('Read', {}, 'abc'), result('x', false, 'r', 'use-abc'), true);
    expect(row.inputKey).toBe('abc:input');
    expect(row.resultKey).toBe('abc:result');
  });
});

describe('describeToolHeader', () => {
  const read = (id: string) => call('Read', { file_path: id }, id);
  const done = (id: string) => result('x', false, `r-${id}`, `use-${id}`);

  it('should have no header when the card holds one call', () => {
    expect(
      describeToolHeader({ id: 'a', name: 'Read', calls: [{ call: read('a') }] }, true),
    ).toBeUndefined();
  });

  it('should have the tag, the count and the done count when the card holds several finished calls', () => {
    const header = describeToolHeader(
      {
        id: 'a',
        name: 'Read',
        calls: [
          { call: read('a'), result: done('a') },
          { call: read('b'), result: done('b') },
          { call: read('c'), result: done('c') },
        ],
      },
      true,
    );
    expect(header).toEqual({
      tag: { name: 'Read', colour: 'read' },
      count: 3,
      done: 3,
      running: 0,
      failed: 0,
    });
  });

  it('should count running and failed calls apart from the done ones', () => {
    const header = describeToolHeader(
      {
        id: 'a',
        name: 'Edit',
        calls: [
          { call: call('Edit', {}, 'a'), result: result('bad', true, 'ra', 'use-a') },
          { call: call('Edit', {}, 'b') },
          { call: call('Edit', {}, 'c'), result: done('c') },
        ],
      },
      true,
    );
    expect(header).toMatchObject({ count: 3, done: 1, running: 1, failed: 1 });
  });

  it('should count no running call when the run has ended', () => {
    const header = describeToolHeader(
      {
        id: 'a',
        name: 'Edit',
        calls: [{ call: call('Edit', {}, 'a') }, { call: call('Edit', {}, 'b') }],
      },
      false,
    );
    expect(header).toMatchObject({ running: 0, done: 0, failed: 0 });
  });
});

describe('describeToolInput', () => {
  it('should show the full input as formatted json', () => {
    expect(describeToolInput(call('Bash', { command: 'ls' }))).toBe(
      JSON.stringify({ command: 'ls' }, null, 2),
    );
  });

  it('should show an empty text when the input is undefined', () => {
    expect(describeToolInput(call('Bash', undefined))).toBe('');
  });
});

describe('describeResultParts', () => {
  it('should hold the text and the image source for a result', () => {
    const mixed: Result = {
      ...result(''),
      parts: [
        { kind: 'text', text: 'big output' },
        { kind: 'image', mediaType: 'image/png', data: 'AAAA' },
      ],
    };
    expect(describeResultParts(mixed)).toEqual([
      { kind: 'text', text: 'big output' },
      { kind: 'image', src: 'data:image/png;base64,AAAA' },
    ]);
  });

  it('should drop an image whose media type is not an image', () => {
    const bad: Result = {
      ...result(''),
      parts: [{ kind: 'image', mediaType: 'text/html', data: 'x' }],
    };
    expect(describeResultParts(bad)).toEqual([]);
  });
});

describe('toggleOpened', () => {
  it('should add a key that is closed and remove one that is open, leaving the others', () => {
    const opened = toggleOpened(new Set(['a:input']), 'a:result');
    expect([...opened].sort()).toEqual(['a:input', 'a:result']);
    expect([...toggleOpened(opened, 'a:input')]).toEqual(['a:result']);
  });
});

describe('describeToolRow titles', () => {
  const root = '/w/repo/7';

  it('should show only the skill name and no toggles when a Skill call succeeds', () => {
    const row = describeToolRow(
      call('Skill', { skill: 'aisf:plan-ticket', args: '521' }),
      result('ok'),
      true,
      root,
    );
    expect(row.headline).toEqual({ text: 'aisf:plan-ticket', mono: true });
    expect(row.inputToggle).toBe(false);
    expect(row.resultToggle).toBeUndefined();
  });

  it('should label the result toggle Error when a Skill call fails', () => {
    const row = describeToolRow(
      call('Skill', { skill: 'aisf:plan-ticket' }),
      result('boom', true),
      true,
      root,
    );
    expect(row.headline?.text).toBe('aisf:plan-ticket');
    expect(row.inputToggle).toBe(false);
    expect(row.resultToggle).toMatchObject({ label: 'Error', error: true });
  });

  it('should show the relative path and keep the result toggle when a Read is inside the root', () => {
    const row = describeToolRow(
      call('Read', { file_path: '/w/repo/7/packages/ui/a.ts', offset: 10, limit: 20 }),
      result('x'),
      true,
      root,
    );
    expect(row.headline).toEqual({ text: 'packages/ui/a.ts', mono: true });
    expect(row.inputToggle).toBe(false);
    expect(row.resultToggle).toBeDefined();
  });

  it('should use ../ segments when a Read is outside the root', () => {
    const row = describeToolRow(
      call('Read', { file_path: '/w/plugins/x.md' }),
      undefined,
      true,
      root,
    );
    expect(row.headline?.text).toBe('../../plugins/x.md');
  });

  it('should show the path as given when no root is known', () => {
    const row = describeToolRow(call('Read', { file_path: '/w/repo/7/a.ts' }), undefined, true);
    expect(row.headline?.text).toBe('/w/repo/7/a.ts');
  });

  it('should make Write, Edit and Grep paths relative and keep their input toggle', () => {
    const rows = [
      describeToolRow(call('Write', { file_path: '/w/repo/7/b.ts' }), undefined, true, root),
      describeToolRow(call('Edit', { file_path: '/w/repo/7/b.ts' }), undefined, true, root),
      describeToolRow(
        call('Grep', { pattern: 'foo', path: '/w/repo/7/src' }),
        undefined,
        true,
        root,
      ),
    ];
    expect(rows.map((row) => row.headline?.text)).toEqual(['b.ts', 'b.ts', '"foo" in src']);
    expect(rows.every((row) => row.inputToggle)).toBe(true);
  });

  it('should show the description in prose when the tool is Agent', () => {
    const row = describeToolRow(call('Agent', { description: 'Critic for plan' }), undefined, true);
    expect(row.headline).toEqual({ text: 'Critic for plan', mono: false });
  });

  it('should show the tool name after the server when the tool is an mcp tool', () => {
    const row = describeToolRow(call('mcp__aisf__aisf_show_artifact', {}), undefined, true);
    expect(row.headline).toEqual({ text: 'aisf_show_artifact', mono: true });
  });
});
