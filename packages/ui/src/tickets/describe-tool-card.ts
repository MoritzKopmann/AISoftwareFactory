import type { SessionEntryResponse } from '@aisf/app/api-schemas/session-stream-schemas.js';
import { relativePath } from './relative-path.js';

export type ToolCallEntry = Extract<SessionEntryResponse, { kind: 'tool-call' }>;
export type ToolResultEntry = Extract<SessionEntryResponse, { kind: 'tool-result' }>;

/** Adjacent calls of one tool, each with the result that carries its `toolUseId`. */
export type ToolCardEntries = {
  readonly id: string;
  readonly name: string;
  readonly calls: ReadonlyArray<{
    readonly call: ToolCallEntry;
    readonly result?: ToolResultEntry;
  }>;
};

export type ToolStatus = 'running' | 'done' | 'failed' | 'none';
type TagColour = 'read' | 'edit' | 'run';
type ToolTag = { readonly name: string; readonly colour: TagColour };

export type ToolRowDescription = {
  readonly status: ToolStatus;
  readonly tag: ToolTag;
  readonly headline?: { readonly text: string; readonly mono: boolean };
  readonly secondLine?: string;
  readonly resultToggle?: {
    readonly label: 'Result' | 'Error';
    readonly size?: string;
    readonly error: boolean;
  };
  /** False when the title already says what the input held. */
  readonly inputToggle: boolean;
  readonly inputKey: string;
  readonly resultKey: string;
};

/** Only a card of 2+ calls has a header. */
export type ToolHeaderDescription = {
  readonly tag: ToolTag;
  readonly count: number;
  readonly done: number;
  readonly running: number;
  readonly failed: number;
};

export type ResultPartDescription =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'image'; readonly src: string };

const imageMediaType = /^image\/[a-z0-9.+-]+$/i;

export function describeToolHeader(
  card: ToolCardEntries,
  live: boolean,
): ToolHeaderDescription | undefined {
  if (card.calls.length < 2) return undefined;
  const statuses = card.calls.map(({ result }) => statusOf(result, live));
  const countStatus = (status: ToolStatus) => statuses.filter((each) => each === status).length;
  return {
    tag: tagOf(card.name),
    count: card.calls.length,
    done: countStatus('done'),
    running: countStatus('running'),
    failed: countStatus('failed'),
  };
}

export function describeToolRow(
  call: ToolCallEntry,
  result: ToolResultEntry | undefined,
  live: boolean,
  root?: string,
): ToolRowDescription {
  const { headline, secondLine } = describeHeadlines(call.name, call.input, root, call.label);
  return {
    status: statusOf(result, live),
    tag: tagOf(call.name),
    ...(headline !== undefined && { headline }),
    ...(secondLine !== undefined && { secondLine }),
    ...(hasResultToggle(call.name, result) && { resultToggle: describeResultToggle(result) }),
    inputToggle: !titleCoversInput(call.name),
    inputKey: toolKeys(call.id).input,
    resultKey: toolKeys(call.id).result,
  };
}

/** The opened-set keys of a call's two panes. */
export function toolKeys(callId: string): { readonly input: string; readonly result: string } {
  return { input: `${callId}:input`, result: `${callId}:result` };
}

export function describeToolInput(call: ToolCallEntry): string {
  return JSON.stringify(call.input, null, 2) ?? '';
}

export function describeResultParts(result: ToolResultEntry): ReadonlyArray<ResultPartDescription> {
  return result.parts.flatMap((part): ResultPartDescription[] => {
    if (part.kind === 'text') return [part];
    if (!imageMediaType.test(part.mediaType)) return [];
    return [{ kind: 'image', src: `data:${part.mediaType};base64,${part.data}` }];
  });
}

export function toggleOpened(opened: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(opened);
  if (!next.delete(key)) next.add(key);
  return next;
}

function titleCoversInput(name: string): boolean {
  return name === 'Skill' || name === 'Read';
}

/** A successful Skill result says nothing the title does not. */
function hasResultToggle(
  name: string,
  result: ToolResultEntry | undefined,
): result is ToolResultEntry {
  if (result === undefined) return false;
  return name !== 'Skill' || result.isError;
}

function statusOf(result: ToolResultEntry | undefined, live: boolean): ToolStatus {
  if (result === undefined) return live ? 'running' : 'none';
  return result.isError ? 'failed' : 'done';
}

function tagOf(name: string): ToolTag {
  return { name, colour: tagColour(name) };
}

function tagColour(name: string): TagColour {
  switch (name) {
    case 'Edit':
    case 'Write':
      return 'edit';
    case 'Bash':
      return 'run';
    default:
      return 'read';
  }
}

function describeHeadlines(
  name: string,
  input: unknown,
  root: string | undefined,
  label: string | undefined,
): { headline?: { text: string; mono: boolean }; secondLine?: string } {
  const field = (key: string): string | undefined => {
    const value =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)[key]
        : undefined;
    return typeof value === 'string' ? value : undefined;
  };
  const mono = (text: string | undefined) =>
    text === undefined ? {} : { headline: { text, mono: true } };
  const pathField = (key: string) => {
    const value = field(key);
    return value === undefined ? undefined : relativePath(root, value);
  };
  switch (name) {
    case 'Read':
    case 'Write':
      return mono(pathField('file_path'));
    case 'Skill':
      return mono(field('skill'));
    case 'Agent': {
      const description = field('description');
      return description === undefined ? {} : { headline: { text: description, mono: false } };
    }
    case 'Glob':
      return mono(field('pattern'));
    case 'Screenshot':
      return mono(field('url'));
    case 'Grep': {
      const pattern = field('pattern');
      const path = pathField('path');
      if (pattern === undefined) return {};
      return mono(path === undefined ? `"${pattern}"` : `"${pattern}" in ${path}`);
    }
    case 'Edit': {
      const oldString = field('old_string');
      const newString = field('new_string');
      return {
        ...mono(pathField('file_path')),
        ...(oldString !== undefined &&
          newString !== undefined && { secondLine: `"${oldString}" → "${newString}"` }),
      };
    }
    case 'Bash': {
      const command = field('command');
      return {
        headline: { text: field('description') ?? label ?? 'Command', mono: false },
        ...(command !== undefined && { secondLine: `$ ${command}` }),
      };
    }
    default: {
      if (!name.startsWith('mcp__')) return {};
      const separator = name.indexOf('__', 'mcp__'.length);
      return separator === -1 ? {} : mono(name.slice(separator + 2));
    }
  }
}

function describeResultToggle(
  result: ToolResultEntry,
): NonNullable<ToolRowDescription['resultToggle']> {
  const size = describeSize(result);
  return {
    label: result.isError ? 'Error' : 'Result',
    ...(size !== '' && { size }),
    error: result.isError,
  };
}

function describeSize(result: ToolResultEntry): string {
  const texts = result.parts.flatMap((part) => (part.kind === 'text' ? [part.text] : []));
  const images = result.parts.length - texts.length;
  const labels = [
    ...(texts.length > 0 ? [count(countLines(texts.join('\n')), 'line')] : []),
    ...(images > 0 ? [count(images, 'image')] : []),
  ];
  return labels.join(' · ');
}

function countLines(text: string): number {
  return text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;
}

function count(amount: number, unit: string): string {
  return `${amount.toLocaleString('en-US')} ${unit}${amount === 1 ? '' : 's'}`;
}
