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

  it('should serve the 600 weight of Atkinson Hyperlegible Next as woff2 when it is requested', async () => {
    const response = await createTestApp().request(
      '/aisf/fonts/atkinson-hyperlegible-next-latin-600-normal.woff2',
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
    '--surface-sunken': '#e1e8ed',
    '--border': '#a9b8c5',
    '--border-strong': '#6f8499',
    '--text': '#13243a',
    '--muted': '#4c6075',
    '--accent': '#c45404',
    '--accent-ink': '#ffffff',
    '--accent-soft': '#f8e2d2',
    '--ok': '#257540',
    '--warn': '#935902',
    '--danger': '#b8322f',
    '--info': '#2d5f93',
    '--hitl': '#6b47c2',
  };
  const darkPalette = {
    '--bg': '#0d1924',
    '--surface': '#122130',
    '--surface-2': '#192b3d',
    '--surface-sunken': '#0a141d',
    '--border': '#2e4760',
    '--border-strong': '#587592',
    '--text': '#d8e4ee',
    '--muted': '#9ab2c7',
    '--accent': '#ff8a45',
    '--accent-ink': '#1c0d03',
    '--accent-soft': '#3b2515',
    '--ok': '#5cc07a',
    '--warn': '#e5ab4e',
    '--danger': '#ff8f84',
    '--info': '#7cb4ea',
    '--hitl': '#baa0ff',
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

  it('should use small radii, square chips and switches, hairline borders and no shadows when the tokens are read', async () => {
    const declarations = declarationsOf(blockStartingWith(await readKitStylesheet(), ':root {'));

    expect(declarations.get('--radius')).toBe('4px');
    expect(declarations.get('--radius-sm')).toBe('2px');
    expect(declarations.get('--radius-chip')).toBe('0');
    expect(declarations.get('--radius-switch')).toBe('0');
    expect(declarations.get('--space')).toBe('4px');
    expect(declarations.get('--pad')).toBe('16px');
    expect(declarations.get('--gap')).toBe('8px');
    expect(declarations.get('--text-size-sm')).toBe('13px');
    expect(declarations.get('--line-sm')).toBe('1.4');
    expect(declarations.get('--card-border')).toBe('1px solid var(--border-strong)');
    expect(declarations.get('--card-shadow')).toBe('none');
  });

  it('should set body text in Atkinson Hyperlegible Next and headings in JetBrains Mono when the tokens are read', async () => {
    const declarations = declarationsOf(blockStartingWith(await readKitStylesheet(), ':root {'));

    expect(declarations.get('--font-ui')).toBe(
      "'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', system-ui, sans-serif",
    );
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
