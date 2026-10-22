import type { SessionToggleView } from './describe-session-toggle.js';

type SessionToggleProps = {
  readonly toggle: SessionToggleView;
  readonly onToggle: () => void;
};

export function SessionToggle({ toggle, onToggle }: SessionToggleProps) {
  return (
    <button
      className="tp-toggle"
      type="button"
      aria-expanded={toggle.expanded}
      aria-controls="ticket-session"
      onClick={onToggle}
    >
      {toggle.label}
    </button>
  );
}
