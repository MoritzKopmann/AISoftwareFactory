import type { DescriptionToggleView } from './describe-description-swap.js';

type DescriptionToggleProps = {
  readonly toggle: DescriptionToggleView;
  readonly onToggle: () => void;
};

export function DescriptionToggle({ toggle, onToggle }: DescriptionToggleProps) {
  if (toggle.kind === 'hidden') {
    return null;
  }
  return (
    <button
      className="tp-toggle"
      type="button"
      aria-expanded={toggle.expanded}
      aria-controls="ticket-description"
      onClick={onToggle}
    >
      {toggle.label}
    </button>
  );
}
