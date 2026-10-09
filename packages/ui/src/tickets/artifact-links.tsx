import type { ArtifactLinksDescription } from './describe-artifact-links.js';

type ArtifactLinksProps = {
  readonly description: ArtifactLinksDescription;
  readonly onRetry: () => void;
};

export function ArtifactLinks({ description, onRetry }: ArtifactLinksProps) {
  const { links, error } = description;
  return (
    <>
      {links.length > 0 && (
        <ul className="artifact-links">
          {links.map((link) => (
            <li key={link.artifactId}>
              <a className="ext" href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {error !== undefined && (
        <div className="err" role="alert">
          <span className="shape" aria-hidden="true">
            ■
          </span>
          <p>{error.message}</p>
          <p className="sm">{error.hint}</p>
          <button className="btn" type="button" onClick={onRetry}>
            Retry
          </button>
          <p className="sm mono">{error.detail}</p>
        </div>
      )}
    </>
  );
}
