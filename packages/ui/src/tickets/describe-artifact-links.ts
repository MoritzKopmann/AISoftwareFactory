import type { TicketArtifactsResponse } from '@aisf/app/api-schemas/artifacts-schemas.js';
import type { TicketArtifactsFailure } from './fetch-ticket-artifacts.js';

export type ArtifactLink = {
  readonly artifactId: string;
  readonly label: string;
  readonly url: string;
};

export type ArtifactLinksError = {
  readonly message: string;
  readonly hint: string;
  readonly detail: string;
};

export type ArtifactLinksDescription = {
  readonly links: ReadonlyArray<ArtifactLink>;
  readonly error?: ArtifactLinksError;
};

const couldntLoad = "Couldn't load the artifact links.";

function describeError(failure: TicketArtifactsFailure): ArtifactLinksError {
  const hint = 'Loads again on the next change, or on Retry.';
  if (failure.kind === 'not-ok') {
    return {
      message: `${couldntLoad} The artifacts route answered ${failure.status}.`,
      hint,
      detail: String(failure.status),
    };
  }
  return { message: `${couldntLoad} Can't reach aisf.`, hint, detail: failure.message };
}

export function describeArtifactLinks(
  response: TicketArtifactsResponse | undefined,
  failure: TicketArtifactsFailure | undefined,
): ArtifactLinksDescription {
  const links = (response?.artifacts ?? [])
    .filter((artifact) => artifact.status === 'open')
    .map((artifact) => ({
      artifactId: artifact.artifactId,
      label: `Open page: ${artifact.title}`,
      url: artifact.url,
    }));
  return failure === undefined ? { links } : { links, error: describeError(failure) };
}
