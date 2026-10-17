import { useEffect, useState } from 'react';
import {
  describeProjectSettings,
  type ProjectSettingsDescription,
  type ProjectSettingsLoad,
  type ProjectSettingsSave,
} from './describe-project-settings.js';
import { loadProjects } from './load-projects.js';
import { setProjectPaused } from './set-project-paused.js';

const skeletonBars: ReadonlyArray<{ readonly width: string | number; readonly height: number }> = [
  { width: '60%', height: 14 },
  { width: '30%', height: 14 },
  { width: 120, height: 32 },
];

type ProjectSettingsViewProps = {
  readonly id: string;
  readonly description: ProjectSettingsDescription;
  readonly onRetry: () => void;
  readonly onToggle: () => void;
};

export function ProjectSettingsView({
  id,
  description,
  onRetry,
  onToggle,
}: ProjectSettingsViewProps) {
  const { backLabel, body } = description;
  if (body.kind === 'unknown') {
    return (
      <main className="page">
        <p role="alert">{body.message}</p>
      </main>
    );
  }
  return (
    <main className="page">
      <a className="back info" href={`#/projects/${id}`}>
        <span className="arrow" aria-hidden="true">
          ←
        </span>
        {backLabel}
      </a>
      <h1 className="page-title">Settings</h1>
      {body.kind === 'loading' && (
        <div style={{ display: 'grid', gap: 12 }} aria-busy="true">
          {skeletonBars.map(({ width, height }) => (
            <span key={width} className="sk" style={{ width, height }} />
          ))}
        </div>
      )}
      {body.kind === 'load-failed' && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{body.message}</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
          <p className="sm mono">{body.detail}</p>
        </div>
      )}
      {body.kind === 'ready' && (
        <>
          <dl className="facts plain">
            <dt className="label">Checkout path</dt>
            <dd className="mono sm">{body.checkoutPath}</dd>
            <dt className="label">Status</dt>
            <dd>
              <span className={body.paused ? 'chip paused' : 'chip'}>{body.statusLabel}</span>
            </dd>
          </dl>
          <div className="ctl">
            <button
              className="btn"
              type="button"
              aria-disabled={body.action.saving ? 'true' : undefined}
              onClick={() => {
                if (!body.action.saving) onToggle();
              }}
            >
              {body.action.saving && (
                <span className="shape pulse acc" aria-hidden="true">
                  ●
                </span>
              )}
              {body.action.label}
            </button>
            {body.note !== undefined && <p className="reason">{body.note}</p>}
          </div>
          {body.error !== undefined && (
            <div className="err" role="alert">
              <span className="shape" aria-hidden="true">
                ■
              </span>
              <p>{body.error}</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export function ProjectSettingsPage({ id }: { readonly id: string }) {
  const [load, setLoad] = useState<ProjectSettingsLoad>({ kind: 'loading' });
  const [save, setSave] = useState<ProjectSettingsSave>({ kind: 'idle' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadProjects((url) => fetch(url)).then((outcome) => {
      if (!cancelled) setLoad(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const retry = () => {
    setLoad({ kind: 'loading' });
    setReloadToken((token) => token + 1);
  };

  const toggle = async () => {
    const project =
      load.kind === 'loaded' ? load.projects.find((candidate) => candidate.id === id) : undefined;
    if (project === undefined) return;
    setSave({ kind: 'saving' });
    const outcome = await setProjectPaused(id, !project.paused, (url, requestInit) =>
      fetch(url, requestInit),
    );
    if (outcome.kind === 'saved') {
      setLoad({
        kind: 'loaded',
        projects: (load.kind === 'loaded' ? load.projects : []).map((candidate) =>
          candidate.id === id ? outcome.project : candidate,
        ),
      });
      setSave({ kind: 'idle' });
      return;
    }
    setSave(
      outcome.status === undefined
        ? { kind: 'failed', message: outcome.message }
        : { kind: 'failed', message: outcome.message, status: outcome.status },
    );
  };

  return (
    <ProjectSettingsView
      id={id}
      description={describeProjectSettings(id, load, save)}
      onRetry={retry}
      onToggle={() => void toggle()}
    />
  );
}
