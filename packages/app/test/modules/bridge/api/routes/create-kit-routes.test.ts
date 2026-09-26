import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createKitRoutes } from '../../../../../src/modules/bridge/api/routes/create-kit-routes.js';

const kitDirectory = fileURLToPath(new URL('../../../../../assets/kit', import.meta.url));

function createTestApp(): Hono {
  return new Hono().route('/aisf', createKitRoutes({ kitDirectory }));
}

async function readKitStylesheet(): Promise<string> {
  const response = await createTestApp().request('/aisf/kit.css');
  return response.text();
}

describe('createKitRoutes', () => {
  it('should serve the stylesheet as css when kit.css is requested', async () => {
    const response = await createTestApp().request('/aisf/kit.css');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/css');
  });

  it('should serve a font as woff2 when a bundled font is requested', async () => {
    const response = await createTestApp().request(
      '/aisf/fonts/jetbrains-mono-latin-400-normal.woff2',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('font/woff2');
  });

  it('should answer 404 when the file is not part of the kit', async () => {
    const response = await createTestApp().request('/aisf/missing.css');

    expect(response.status).toBe(404);
  });
});

describe('kit.css', () => {
  const lightPalette = {
    '--bg': '#e9eef2',
    '--surface': '#f8fafb',
    '--surface-2': '#dfe6ec',
    '--border': '#a9b8c5',
    '--border-strong': '#6f8499',
    '--text': '#13243a',
    '--muted': '#4c6075',
    '--accent': '#d05f1a',
    '--accent-ink': '#ffffff',
    '--accent-soft': '#f8e2d2',
    '--ok': '#2b7a44',
    '--warn': '#a2640b',
    '--danger': '#b8322f',
    '--info': '#2d5f93',
    '--hitl': '#6b47c2',
  };
  const darkPalette = {
    '--bg': '#0d1924',
    '--surface': '#122130',
    '--surface-2': '#192b3d',
    '--border': '#2e4760',
    '--border-strong': '#4d6a86',
    '--text': '#d8e4ee',
    '--muted': '#8aa1b6',
    '--accent': '#ff8a45',
    '--accent-ink': '#1c0d03',
    '--accent-soft': '#3b2515',
    '--ok': '#5cc07a',
    '--warn': '#e5ab4e',
    '--danger': '#f07268',
    '--info': '#6fa6db',
    '--hitl': '#a98cf0',
  };

  function declarationsOf(block: string): ReadonlyMap<string, string> {
    return new Map(
      [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
        match[1] ?? '',
        (match[2] ?? '').trim(),
      ]),
    );
  }

  // The stylesheet lists the light tokens on :root, then the dark tokens twice:
  // under the OS preference and under an explicit data-theme='dark'.
  function blockStartingWith(stylesheet: string, selector: string): string {
    const start = stylesheet.indexOf(selector);
    expect(start, `selector ${selector} in kit.css`).toBeGreaterThanOrEqual(0);
    const open = stylesheet.indexOf('{', start);
    return stylesheet.slice(open + 1, stylesheet.indexOf('}', open));
  }

  it('should define every light palette value on :root when the stylesheet loads', async () => {
    const declarations = declarationsOf(blockStartingWith(await readKitStylesheet(), ':root {'));

    expect(Object.fromEntries(declarations)).toMatchObject(lightPalette);
  });

  it('should define every dark palette value under the OS preference when no theme is forced', async () => {
    const stylesheet = await readKitStylesheet();
    const mediaQuery = stylesheet.slice(stylesheet.indexOf('@media (prefers-color-scheme: dark)'));
    const declarations = declarationsOf(
      blockStartingWith(mediaQuery, ":root:not([data-theme='light'])"),
    );

    expect(Object.fromEntries(declarations)).toMatchObject(darkPalette);
  });

  it('should define every dark palette value when data-theme is dark', async () => {
    const declarations = declarationsOf(
      blockStartingWith(await readKitStylesheet(), ":root[data-theme='dark']"),
    );

    expect(Object.fromEntries(declarations)).toMatchObject(darkPalette);
  });

  it('should use zero radius, hairline borders and no shadows when the tokens are read', async () => {
    const declarations = declarationsOf(blockStartingWith(await readKitStylesheet(), ':root {'));

    expect(declarations.get('--radius')).toBe('0');
    expect(declarations.get('--space')).toBe('4px');
    expect(declarations.get('--card-border')).toBe('1px solid var(--border-strong)');
    expect(declarations.get('--card-shadow')).toBe('none');
  });

  it('should set body text in Atkinson Hyperlegible and headings in JetBrains Mono when the tokens are read', async () => {
    const declarations = declarationsOf(blockStartingWith(await readKitStylesheet(), ':root {'));

    expect(declarations.get('--font-ui')).toContain("'Atkinson Hyperlegible'");
    expect(declarations.get('--font-mono')).toContain("'JetBrains Mono'");
    expect(declarations.get('--font-display')).toBe('var(--font-mono)');
    expect(declarations.get('--display-transform')).toBe('uppercase');
  });

  it('should reference only bundled fonts when the stylesheet is read', async () => {
    const stylesheet = await readKitStylesheet();
    const bundledFonts = await readdir(`${kitDirectory}/fonts`);
    const referencedUrls = [...stylesheet.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(
      (match) => match[1] ?? '',
    );

    expect(referencedUrls.length).toBeGreaterThan(0);
    for (const referencedUrl of referencedUrls) {
      expect(referencedUrl).toMatch(/^\/aisf\/fonts\//);
      expect(bundledFonts).toContain(referencedUrl.replace('/aisf/fonts/', ''));
    }
    expect(stylesheet).not.toMatch(/https?:\/\//);
  });
});
