import { useRef, useState } from 'react';
import { useGatedSkeleton } from '../board/use-gated-skeleton.js';
import { createTicketFromFinding } from './create-ticket-from-finding.js';
import {
  describeKnownBugs,
  type FindingPress,
  type KnownBugRowAction,
  type KnownBugsDescription,
} from './describe-known-bugs.js';
import { describeKnownBugsTrigger, hasKnownBugsTrigger } from './describe-known-bugs-trigger.js';
import { dismissFinding } from './dismiss-finding.js';
import type { LiveUpdates } from '../live/live-updates.js';
import {
  nextKnownBugsPopoverOpen,
  type KnownBugsPopoverEvent,
} from './next-known-bugs-popover-open.js';
import { useFindings } from './use-findings.js';

const skeletonLineWidths: ReadonlyArray<readonly [string, string]> = [
  ['75%', '45%'],
  ['60%', '35%'],
];

type KnownBugsSectionProps = {
  readonly description: KnownBugsDescription;
  readonly skeletonVisible: boolean;
  readonly onRetry: () => void;
  readonly onShowAll: () => void;
  readonly onCreateTicket: (findingId: number) => void;
  readonly onDismiss: (findingId: number) => void;
};

type KnownBugActionsProps = {
  readonly action: KnownBugRowAction;
  readonly onCreateTicket: () => void;
  readonly onDismiss: () => void;
};

function KnownBugActions({ action, onCreateTicket, onDismiss }: KnownBugActionsProps) {
  if (action.kind === 'created') {
    return (
      <div className="actions">
        <span className="made" role="status">
          <span className="shape s-done" aria-hidden="true">
            ✓
          </span>
          <a href={action.ticketHref}>
            <span className="num-id">{action.ticketLabel}</span> created
          </a>
        </span>
      </div>
    );
  }
  const creating = action.kind === 'creating';
  const pressable = action.kind === 'idle' || action.kind === 'failed';
  return (
    <div className="actions">
      <button
        className="btn"
        type="button"
        aria-disabled={pressable ? undefined : 'true'}
        onClick={() => {
          if (pressable) onCreateTicket();
        }}
      >
        {creating && (
          <span className="shape s-flow pulse" aria-hidden="true">
            ●
          </span>
        )}
        {creating ? 'Creating…' : 'Create ticket'}
      </button>
      <button
        className="btn quiet"
        type="button"
        aria-disabled={pressable ? undefined : 'true'}
        onClick={() => {
          if (pressable) onDismiss();
        }}
      >
        Dismiss
      </button>
      {creating && (
        <span className="vh" role="status">
          Creating a ticket
        </span>
      )}
    </div>
  );
}

function KnownBugsSkeleton() {
  return (
    <section className="row findings" aria-label="Known bugs" aria-busy="true">
      <div className="row-h">
        <span className="label">Known bugs</span>
        <span className="sk" style={{ width: 14, height: 10 }} />
        <span className="vh" role="status">
          Loading known bugs…
        </span>
      </div>
      <div className="finding-box" style={{ borderColor: 'var(--border)' }}>
        {skeletonLineWidths.map(([firstWidth, secondWidth]) => (
          <div key={firstWidth} className="sk-finding">
            <span className="sk" style={{ height: 18 }} />
            <span className="lines">
              <span className="sk sk-line" style={{ width: firstWidth }} />
              <span className="sk sk-line" style={{ width: secondWidth }} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

type KnownBugsPopoverViewProps = {
  readonly description: KnownBugsDescription;
  readonly open: boolean;
  readonly onOpenEvent: (event: KnownBugsPopoverEvent) => void;
  readonly onRetry: () => void;
  readonly onShowAll: () => void;
  readonly onCreateTicket: (findingId: number) => void;
  readonly onDismiss: (findingId: number) => void;
};

export function KnownBugsPopoverView({
  description,
  open,
  onOpenEvent,
  onRetry,
  onShowAll,
  onCreateTicket,
  onDismiss,
}: KnownBugsPopoverViewProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!hasKnownBugsTrigger(description)) {
    return null;
  }
  const trigger = describeKnownBugsTrigger(description);
  return (
    <div
      className="kb-popover"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') onOpenEvent('pointer-enter');
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') onOpenEvent('pointer-leave');
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          onOpenEvent('escape');
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        className="kb-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenEvent('toggle')}
      >
        <span className="kb-mark" aria-hidden="true">
          ■
        </span>
        {trigger.label}
      </button>
      {open && (
        <div className="kb-pop">
          <div className="kb-dialog" role="dialog" aria-label="Known bugs">
            <div className="kb-head">
              <span className="label">Known bugs</span>
              {description.kind === 'list' && (
                <span className="kb-count">{description.countLabel}</span>
              )}
            </div>
            {description.kind === 'error' ? (
              <KnownBugsError description={description} onRetry={onRetry} />
            ) : (
              <>
                <KnownBugsBanner banner={description.banner} onRetry={onRetry} />
                <div className="kb-list">
                  <KnownBugsRows
                    rows={description.rows}
                    onCreateTicket={onCreateTicket}
                    onDismiss={onDismiss}
                  />
                </div>
                <KnownBugsFoot footer={description.footer} onShowAll={onShowAll} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function KnownBugsSection({
  description,
  skeletonVisible,
  onRetry,
  onShowAll,
  onCreateTicket,
  onDismiss,
}: KnownBugsSectionProps) {
  const [open, setOpen] = useState(true);

  if (skeletonVisible) {
    return <KnownBugsSkeleton />;
  }
  if (description.kind === 'loading') {
    return null;
  }
  if (description.kind === 'error') {
    return (
      <section className="row findings" aria-label="Known bugs">
        <div className="row-h">
          <span className="label">Known bugs</span>
        </div>
        <KnownBugsError description={description} onRetry={onRetry} />
      </section>
    );
  }
  if (description.kind === 'empty') {
    return (
      <section className="row findings" aria-label="Known bugs">
        <div className="row-h">
          <span className="label">Known bugs</span>
          <span className="n">0</span>
          <span className="none">None</span>
        </div>
      </section>
    );
  }
  const { countLabel, rows, banner, footer } = description;
  return (
    <details
      className="row findings"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="row-h">
        <span className="chev" aria-hidden="true">
          ›
        </span>
        <span className="label">Known bugs</span>
        <span className="n">{countLabel}</span>
        <span className="toggle-text">
          <span className="t-show">Show</span>
          <span className="t-hide">Hide</span>
        </span>
      </summary>
      <div className="finding-box">
        <KnownBugsBanner banner={banner} onRetry={onRetry} />
        <KnownBugsRows rows={rows} onCreateTicket={onCreateTicket} onDismiss={onDismiss} />
        <KnownBugsFoot footer={footer} onShowAll={onShowAll} />
      </div>
    </details>
  );
}

type KnownBugsErrorProps = {
  readonly description: Extract<KnownBugsDescription, { readonly kind: 'error' }>;
  readonly onRetry: () => void;
};

function KnownBugsError({ description, onRetry }: KnownBugsErrorProps) {
  return (
    <div className="err" role="alert">
      <span className="shape" aria-hidden="true">
        ■
      </span>
      <p>{description.message}</p>
      <p className="sm">Loads again on the next change, or on Retry.</p>
      <button className="btn" type="button" onClick={onRetry}>
        Retry
      </button>
      <p className="sm mono">{description.detail}</p>
    </div>
  );
}

type ListDescription = Extract<KnownBugsDescription, { readonly kind: 'list' }>;

function KnownBugsBanner({
  banner,
  onRetry,
}: {
  readonly banner: ListDescription['banner'];
  readonly onRetry: () => void;
}) {
  if (banner === undefined) {
    return null;
  }
  return (
    <div className="inline-banner" role="status">
      <span className="shape" aria-hidden="true">
        ▲
      </span>
      <p className="sm">{banner}</p>
      <button className="btn" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

type KnownBugsRowsProps = {
  readonly rows: ListDescription['rows'];
  readonly onCreateTicket: (findingId: number) => void;
  readonly onDismiss: (findingId: number) => void;
};

function KnownBugsRows({ rows, onCreateTicket, onDismiss }: KnownBugsRowsProps) {
  return (
    <ul className="finding-list">
      {rows.map((row) => (
        <li key={row.id} className="finding">
          <span className={`chip ${row.chipTone}`}>{row.chipLabel}</span>
          <div className="body">
            <p className="summary">{row.summary}</p>
            <p className="where">
              <code className="loc">{row.location}</code>
              {row.source !== undefined && (
                <span>
                  from{' '}
                  <a href={row.source.href}>
                    <span className="num-id">{row.source.label}</span>
                  </a>
                </span>
              )}
            </p>
          </div>
          <KnownBugActions
            action={row.action}
            onCreateTicket={() => onCreateTicket(row.id)}
            onDismiss={() => onDismiss(row.id)}
          />
          {row.action.kind === 'failed' && (
            <div className="err" role="alert">
              <span className="shape" aria-hidden="true">
                ■
              </span>
              <p>{row.action.message}</p>
              <p className="sm mono">{row.action.detail}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function KnownBugsFoot({
  footer,
  onShowAll,
}: {
  readonly footer: ListDescription['footer'];
  readonly onShowAll: () => void;
}) {
  if (footer === undefined) {
    return null;
  }
  return (
    <div className="list-foot">
      <span>{footer}</span>
      <button className="btn" type="button" onClick={onShowAll}>
        Show all
      </button>
    </div>
  );
}

type KnownBugsProps = {
  readonly liveUpdates: LiveUpdates;
  readonly projectId: string;
  readonly ticketNumber?: number;
  readonly variant?: 'section' | 'popover';
};

export function KnownBugs({
  liveUpdates,
  projectId,
  ticketNumber,
  variant = 'section',
}: KnownBugsProps) {
  const { findingsPoll, retry } = useFindings(liveUpdates, projectId, ticketNumber);
  const [showAll, setShowAll] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [presses, setPresses] = useState<ReadonlyMap<number, FindingPress>>(new Map());
  const description = describeKnownBugs(findingsPoll, presses, projectId, showAll, ticketNumber);
  const skeletonVisible = useGatedSkeleton(description.kind === 'loading');

  const holdPress = (findingId: number, press: FindingPress) => {
    setPresses((previous) => new Map(previous).set(findingId, press));
  };

  const createTicket = async (findingId: number) => {
    holdPress(findingId, { kind: 'creating' });
    const outcome = await createTicketFromFinding(projectId, findingId, (url, requestInit) =>
      fetch(url, requestInit),
    );
    holdPress(
      findingId,
      outcome.kind === 'created'
        ? outcome
        : { kind: 'failed', action: 'create-ticket', failure: outcome },
    );
  };

  const dismiss = async (findingId: number) => {
    holdPress(findingId, { kind: 'dismissing' });
    const outcome = await dismissFinding(projectId, findingId, (url, requestInit) =>
      fetch(url, requestInit),
    );
    holdPress(
      findingId,
      outcome.kind === 'dismissed'
        ? outcome
        : { kind: 'failed', action: 'dismiss', failure: outcome },
    );
  };

  if (variant === 'popover') {
    return (
      <KnownBugsPopoverView
        description={description}
        open={popoverOpen}
        onOpenEvent={(event) => setPopoverOpen((open) => nextKnownBugsPopoverOpen(open, event))}
        onRetry={retry}
        onShowAll={() => setShowAll(true)}
        onCreateTicket={(findingId) => void createTicket(findingId)}
        onDismiss={(findingId) => void dismiss(findingId)}
      />
    );
  }

  return (
    <KnownBugsSection
      description={description}
      skeletonVisible={skeletonVisible}
      onRetry={retry}
      onShowAll={() => setShowAll(true)}
      onCreateTicket={(findingId) => void createTicket(findingId)}
      onDismiss={(findingId) => void dismiss(findingId)}
    />
  );
}
