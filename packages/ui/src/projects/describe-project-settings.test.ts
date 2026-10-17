import { describe, expect, it } from 'vitest';
import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';
import { describeProjectSettings } from './describe-project-settings.js';

function project(paused: boolean): ProjectResponse {
  return {
    id: 'acme/postcards',
    repository: { owner: 'acme', name: 'postcards' },
    checkoutPath: '/checkouts/postcards',
    addedAt: '2026-01-01T00:00:00Z',
    paused,
    contract: { passed: true, missingSlots: [], missingKeys: [] },
  };
}

const idle = { kind: 'idle' } as const;

describe('describeProjectSettings', () => {
  it('should describe the loading state with the repository name for the back link while the projects load', () => {
    expect(describeProjectSettings('acme/postcards', { kind: 'loading' }, idle)).toEqual({
      backLabel: 'postcards',
      body: { kind: 'loading' },
    });
  });

  it('should describe the load error with its detail when the load failed', () => {
    expect(
      describeProjectSettings('acme/postcards', { kind: 'failed', detail: 'HTTP 500' }, idle),
    ).toEqual({
      backLabel: 'postcards',
      body: {
        kind: 'load-failed',
        message: 'Could not load the project settings.',
        detail: 'HTTP 500',
      },
    });
  });

  it('should describe an unknown project when no loaded project has the id', () => {
    const description = describeProjectSettings(
      'acme/other',
      { kind: 'loaded', projects: [project(false)] },
      idle,
    );
    expect(description.body).toEqual({
      kind: 'unknown',
      message: 'No project acme/other is registered.',
    });
  });

  it('should describe the checkout path, the Active chip and Pause project when the project is not paused', () => {
    const description = describeProjectSettings(
      'acme/postcards',
      { kind: 'loaded', projects: [project(false)] },
      idle,
    );
    expect(description.body).toEqual({
      kind: 'ready',
      checkoutPath: '/checkouts/postcards',
      paused: false,
      statusLabel: 'Active',
      action: { label: 'Pause project', saving: false },
    });
  });

  it('should describe the Paused chip, Unpause project and the note when the project is paused', () => {
    const description = describeProjectSettings(
      'acme/postcards',
      { kind: 'loaded', projects: [project(true)] },
      idle,
    );
    expect(description.body).toEqual({
      kind: 'ready',
      checkoutPath: '/checkouts/postcards',
      paused: true,
      statusLabel: 'Paused',
      action: { label: 'Unpause project', saving: false },
      note: 'No new runs start automatically. Running runs finish.',
    });
  });

  it('should describe Pausing… as saving and keep the Active chip when a pause is being saved', () => {
    const description = describeProjectSettings(
      'acme/postcards',
      { kind: 'loaded', projects: [project(false)] },
      { kind: 'saving' },
    );
    expect(description.body).toMatchObject({
      statusLabel: 'Active',
      action: { label: 'Pausing…', saving: true },
    });
  });

  it('should describe Unpausing… as saving and keep the Paused chip when an unpause is being saved', () => {
    const description = describeProjectSettings(
      'acme/postcards',
      { kind: 'loaded', projects: [project(true)] },
      { kind: 'saving' },
    );
    expect(description.body).toMatchObject({
      statusLabel: 'Paused',
      action: { label: 'Unpausing…', saving: true },
    });
  });

  it("should add the server's message as the error and keep chip and button when saving failed", () => {
    const description = describeProjectSettings(
      'acme/postcards',
      { kind: 'loaded', projects: [project(false)] },
      { kind: 'failed', message: 'Project acme/postcards is not registered.', status: 404 },
    );
    expect(description.body).toEqual({
      kind: 'ready',
      checkoutPath: '/checkouts/postcards',
      paused: false,
      statusLabel: 'Active',
      action: { label: 'Pause project', saving: false },
      error: 'Project acme/postcards is not registered.',
    });
  });

  it('should fall back to the status as the error when the server sent no message', () => {
    const description = describeProjectSettings(
      'acme/postcards',
      { kind: 'loaded', projects: [project(false)] },
      { kind: 'failed', message: '', status: 500 },
    );
    expect(description.body).toMatchObject({ error: 'HTTP 500' });
  });
});
