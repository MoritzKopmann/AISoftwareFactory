import { describeUsageWindow, type UsageWindow } from './describe-usage-window.js';

export function UsageWindowCard({
  name,
  window,
}: {
  readonly name: string;
  readonly window: UsageWindow | null;
}) {
  const description = describeUsageWindow(window, new Date());
  const label = `${name} window`;

  if (description.noData) {
    return (
      <section aria-label={label} className="usage-card">
        <div className="usage-card-head">
          <h2 className="label">{label}</h2>
        </div>
        <div className="usage-card-nodata">No data yet</div>
        <div>
          <UsageCardWarnLabel />
          <div aria-hidden="true" className="usage-card-track usage-card-track-empty">
            <span className="usage-card-mark-warn" />
            <span className="usage-card-mark-pause" />
          </div>
          <UsageCardPauseLabel />
        </div>
      </section>
    );
  }

  return (
    <section aria-label={label} className={`usage-card ${description.tone}`}>
      <div className="usage-card-head">
        <h2 className="label">{label}</h2>
        <span className="usage-card-reset">{`Resets ${description.resetLabel}`}</span>
      </div>
      <div className="usage-card-value">{description.valueLabel}</div>
      <div>
        <UsageCardWarnLabel />
        <div
          role="meter"
          aria-label={`${name} usage`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={description.utilizationPercent}
          className="usage-card-track"
        >
          <span
            className="usage-card-fill"
            style={{ width: `${description.utilizationPercent}%` }}
          />
          <span className="usage-card-mark-warn" />
          <span className="usage-card-mark-pause" />
        </div>
        <UsageCardPauseLabel />
      </div>
    </section>
  );
}

export function UsageWindowSkeleton({
  name,
  announce = false,
}: {
  readonly name: string;
  readonly announce?: boolean;
}) {
  const label = `${name} window`;

  return (
    <section aria-busy="true" aria-label={label} className="usage-card">
      <div className="usage-card-head">
        <h2 className="label">{label}</h2>
        <span aria-hidden="true" className="pulse usage-card-skeleton usage-card-skeleton-reset" />
      </div>
      <span aria-hidden="true" className="pulse usage-card-skeleton usage-card-skeleton-value" />
      <span aria-hidden="true" className="pulse usage-card-skeleton usage-card-skeleton-track" />
      {announce && (
        <span role="status" className="vh">
          Loading usage…
        </span>
      )}
    </section>
  );
}

function UsageCardWarnLabel() {
  return (
    <div aria-hidden="true" className="usage-card-scale usage-card-scale-above">
      <span className="usage-card-scale-warn">80 % warning</span>
    </div>
  );
}

function UsageCardPauseLabel() {
  return (
    <div aria-hidden="true" className="usage-card-scale">
      <span className="usage-card-scale-pause">100 % pause</span>
    </div>
  );
}
