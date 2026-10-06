// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { registry } from '../../../assets/kit/kit.js';

const referencePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../plugin/skills/artifacts/references/elements.md',
);

type Documented = Record<string, string[]>;
type Registered = Record<string, string[]>;

/** Reads each `## `<aisf-x>`` heading and the `Attributes:` line under it. */
function parseReference(markdown: string): Documented {
  const documented: Documented = {};
  let tag: string | undefined;
  for (const line of markdown.split('\n')) {
    const heading = /^##\s+`<(aisf-[a-z-]+)>`/.exec(line);
    if (heading?.[1] !== undefined) {
      tag = heading[1];
      documented[tag] = [];
      continue;
    }
    if (tag !== undefined && line.startsWith('Attributes:')) {
      documented[tag] = [...line.matchAll(/`([a-z-]+)`/g)].map((match) => match[1] ?? '');
    }
  }
  return documented;
}

function registeredFromKit(): Registered {
  const result: Registered = {};
  for (const [tag, elementClass] of Object.entries(registry)) {
    result[tag] = [
      ...(elementClass as unknown as { observedAttributes: string[] }).observedAttributes,
    ];
  }
  return result;
}

/** Every mismatch between the documented elements and the registered ones, one line each. */
function findMismatches(documented: Documented, registered: Registered): string[] {
  const problems: string[] = [];
  for (const tag of Object.keys(documented)) {
    if (!(tag in registered)) problems.push(`documented but not registered: ${tag}`);
  }
  for (const [tag, attributes] of Object.entries(registered)) {
    const documentedAttributes = documented[tag];
    if (documentedAttributes === undefined) {
      problems.push(`registered but not documented: ${tag}`);
      continue;
    }
    for (const attribute of documentedAttributes) {
      if (!attributes.includes(attribute))
        problems.push(`documented but not observed: ${tag} ${attribute}`);
    }
    for (const attribute of attributes) {
      if (!documentedAttributes.includes(attribute))
        problems.push(`observed but not documented: ${tag} ${attribute}`);
    }
  }
  return problems;
}

describe('elements reference', () => {
  const kit: Registered = { 'aisf-a': ['x', 'y'], 'aisf-b': [] };

  it('should report no mismatch when the reference matches the kit', () => {
    const markdown = '## `<aisf-a>`\nAttributes: `x`, `y`\n\n## `<aisf-b>`\nAttributes: none\n';
    expect(findMismatches(parseReference(markdown), kit)).toEqual([]);
  });

  it('should name the element when the reference documents one the kit does not register', () => {
    const markdown =
      '## `<aisf-a>`\nAttributes: `x`, `y`\n\n## `<aisf-b>`\nAttributes: none\n\n## `<aisf-c>`\nAttributes: none\n';
    expect(findMismatches(parseReference(markdown), kit)).toEqual([
      'documented but not registered: aisf-c',
    ]);
  });

  it('should name the element when the kit registers one the reference lacks', () => {
    const markdown = '## `<aisf-a>`\nAttributes: `x`, `y`\n';
    expect(findMismatches(parseReference(markdown), kit)).toEqual([
      'registered but not documented: aisf-b',
    ]);
  });

  it('should name element and attribute when the reference documents one the class does not list', () => {
    const markdown =
      '## `<aisf-a>`\nAttributes: `x`, `y`, `z`\n\n## `<aisf-b>`\nAttributes: none\n';
    expect(findMismatches(parseReference(markdown), kit)).toEqual([
      'documented but not observed: aisf-a z',
    ]);
  });

  it('should name element and attribute when the class lists one the reference lacks', () => {
    const markdown = '## `<aisf-a>`\nAttributes: `x`\n\n## `<aisf-b>`\nAttributes: none\n';
    expect(findMismatches(parseReference(markdown), kit)).toEqual([
      'observed but not documented: aisf-a y',
    ]);
  });

  it('should match the real kit when reading the shipped elements.md', () => {
    const markdown = readFileSync(referencePath, 'utf8');
    expect(findMismatches(parseReference(markdown), registeredFromKit())).toEqual([]);
  });
});
