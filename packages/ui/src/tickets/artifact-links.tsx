import type { ArtifactLink } from './describe-artifact-links.js';

type ArtifactLinksProps = {
  readonly links: ReadonlyArray<ArtifactLink>;
};

export function ArtifactLinks({ links }: ArtifactLinksProps) {
  if (links.length === 0) {
    return null;
  }
  return (
    <ul className="artifact-links">
      {links.map((link) => (
        <li key={link.artifactId}>
          <a className="ext" href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
