import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProjectSettingsBody } from './describe-project-settings.js';
import { ProjectSettingsView } from './project-settings-page.js';

const ignore = () => undefined;

function render(body: ProjectSettingsBody): string {
  return renderToStaticMarkup(
    <ProjectSettingsView
      id="acme/postcards"
      description={{ backLabel: 'postcards', body }}
      onRetry={ignore}
      onToggle={ignore}
    />,
  );
}

const ready: Extract<ProjectSettingsBody, { kind: 'ready' }> = {
  kind: 'ready',
  checkoutPath: '/checkouts/postcards',
  paused: false,
  statusLabel: 'Active',
  action: { label: 'Pause project', saving: false },
};

describe('ProjectSettingsView', () => {
  it('should link back to the project page with the repository name and show the Settings heading', () => {
    const markup = render(ready);
    expect(markup).toMatch(
      /<a class="back[^"]*" href="#\/projects\/acme\/postcards">.*postcards<\/a>/,
    );
    expect(markup).toContain('>Settings</h1>');
  });

  it('should mark the page busy and show no facts while loading', () => {
    const markup = render({ kind: 'loading' });
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain('Checkout path');
  });

  it('should announce the load error with its detail and a Retry button when the load failed', () => {
    const markup = render({
      kind: 'load-failed',
      message: 'Could not load the project settings.',
      detail: 'HTTP 500',
    });
    expect(markup).toMatch(/role="alert"[^>]*>.*Could not load the project settings\./);
    expect(markup).toMatch(/<button[^>]*>Retry<\/button>/);
    expect(markup).toContain('HTTP 500');
  });

  it('should announce that the project is not registered when it is unknown', () => {
    const markup = render({ kind: 'unknown', message: 'No project acme/postcards is registered.' });
    expect(markup).toMatch(/role="alert"[^>]*>No project acme\/postcards is registered\./);
  });

  it('should show the checkout path, the Active chip and a pressable Pause project when ready', () => {
    const markup = render(ready);
    expect(markup).toContain('/checkouts/postcards');
    expect(markup).toMatch(/<span class="chip[^"]*">Active<\/span>/);
    expect(markup).toMatch(/<button[^>]*>Pause project<\/button>/);
    expect(markup).not.toContain('aria-disabled');
  });

  it('should show the Paused chip and the note when paused', () => {
    const markup = render({
      ...ready,
      paused: true,
      statusLabel: 'Paused',
      action: { label: 'Unpause project', saving: false },
      note: 'No new runs start automatically. Running runs finish.',
    });
    expect(markup).toMatch(/<span class="chip paused">Paused<\/span>/);
    expect(markup).toContain('Unpause project');
    expect(markup).toContain('No new runs start automatically. Running runs finish.');
  });

  it('should keep the saving button focusable and aria-disabled while saving', () => {
    const markup = render({ ...ready, action: { label: 'Pausing…', saving: true } });
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toMatch(/\sdisabled=""/);
    expect(markup).toContain('Pausing…');
  });

  it('should announce the save error through an alert when saving failed', () => {
    const markup = render({ ...ready, error: 'Project acme/postcards is not registered.' });
    expect(markup).toMatch(/role="alert"[^>]*>.*Project acme\/postcards is not registered\./);
  });
});
