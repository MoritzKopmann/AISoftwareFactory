import type { RoundPanelDescription } from './describe-round-panel.js';

export function RoundPanel({ description }: { readonly description: RoundPanelDescription }) {
  if (description.kind === 'hidden') {
    return null;
  }
  return (
    <section className="round-panel" aria-label={description.title}>
      <h2>{description.title}</h2>
      <iframe
        title={description.title}
        src={description.url}
        style={{ width: '100%', height: '70vh', border: 0 }}
      />
    </section>
  );
}
