export type ArtifactKind = 'page' | 'board';

const BOARD_ARTIFACT_ID = 'design';

export function artifactKindFor(artifactId: string): ArtifactKind {
  return artifactId === BOARD_ARTIFACT_ID ? 'board' : 'page';
}
