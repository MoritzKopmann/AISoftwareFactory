import type { UsageState } from './use-usage.js';
import { UsageWindowCard, UsageWindowSkeleton } from './usage-window-card.js';
import { windowsOf } from './usage-windows.js';

export function UsagePage({ usage }: { readonly usage: UsageState }) {
  return (
    <main className="page">
      <div className="page-head">
        <h1>Usage</h1>
      </div>
      <div className="usage-cards">
        <UsageCards usage={usage} />
      </div>
    </main>
  );
}

function UsageCards({ usage }: { readonly usage: UsageState }) {
  if (usage.kind === 'failed') {
    return (
      <div role="alert" className="usage-failed">
        <span aria-hidden="true" className="usage-failed-mark">
          ■
        </span>
        <p>Usage could not be loaded.</p>
        <p className="usage-failed-hint">Loads again on the next change.</p>
      </div>
    );
  }

  if (usage.kind === 'loading') {
    return (
      <>
        <UsageWindowSkeleton name="5-hour" announce />
        <UsageWindowSkeleton name="Weekly" />
      </>
    );
  }

  const windows = windowsOf(usage.usage);
  return (
    <>
      <UsageWindowCard name="5-hour" window={windows.fiveHour} />
      <UsageWindowCard name="Weekly" window={windows.sevenDay} />
    </>
  );
}
