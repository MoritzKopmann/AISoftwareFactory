import type { ProjectResponse } from '@aisf/app/api-schemas/projects-schemas.js';

export type ProjectSettingsLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly detail: string }
  | { readonly kind: 'loaded'; readonly projects: ReadonlyArray<ProjectResponse> };

export type ProjectSettingsSave =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'failed'; readonly message: string; readonly status?: number };

export type ProjectSettingsBody =
  | { readonly kind: 'loading' }
  | { readonly kind: 'load-failed'; readonly message: string; readonly detail: string }
  | { readonly kind: 'unknown'; readonly message: string }
  | {
      readonly kind: 'ready';
      readonly checkoutPath: string;
      readonly paused: boolean;
      readonly statusLabel: 'Active' | 'Paused';
      readonly action: { readonly label: string; readonly saving: boolean };
      readonly note?: string;
      readonly error?: string;
    };

export type ProjectSettingsDescription = {
  readonly backLabel: string;
  readonly body: ProjectSettingsBody;
};

export function describeProjectSettings(
  id: string,
  load: ProjectSettingsLoad,
  save: ProjectSettingsSave,
): ProjectSettingsDescription {
  const backLabel = id.slice(id.indexOf('/') + 1);
  if (load.kind === 'loading') {
    return { backLabel, body: { kind: 'loading' } };
  }
  if (load.kind === 'failed') {
    return {
      backLabel,
      body: {
        kind: 'load-failed',
        message: 'Could not load the project settings.',
        detail: load.detail,
      },
    };
  }
  const project = load.projects.find((candidate) => candidate.id === id);
  if (project === undefined) {
    return { backLabel, body: { kind: 'unknown', message: `No project ${id} is registered.` } };
  }
  return { backLabel, body: describeReady(project, save) };
}

function describeReady(project: ProjectResponse, save: ProjectSettingsSave): ProjectSettingsBody {
  const { paused, checkoutPath } = project;
  const saving = save.kind === 'saving';
  const idleLabel = paused ? 'Unpause project' : 'Pause project';
  const savingLabel = paused ? 'Unpausing…' : 'Pausing…';
  const error = describeSaveError(save);
  return {
    kind: 'ready',
    checkoutPath,
    paused,
    statusLabel: paused ? 'Paused' : 'Active',
    action: { label: saving ? savingLabel : idleLabel, saving },
    ...(paused && { note: 'No new runs start automatically. Running runs finish.' }),
    ...(error !== undefined && { error }),
  };
}

function describeSaveError(save: ProjectSettingsSave): string | undefined {
  if (save.kind !== 'failed') return undefined;
  if (save.message !== '') return save.message;
  return save.status === undefined ? '' : `HTTP ${save.status}`;
}
