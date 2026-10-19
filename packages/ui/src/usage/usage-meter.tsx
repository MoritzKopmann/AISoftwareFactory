import { useEffect, useState } from 'react';
import type { UsageResponse } from '@aisf/app/api-schemas/usage-schemas.js';
import { describeUsageWindow, type UsageWindowDescription } from './describe-usage-window.js';
import type { UsageState } from './use-usage.js';

export function UsageMeter({ usage }: { readonly usage: UsageState }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (usage.kind !== 'loaded') return;
    const delay = msUntilNextReset(usage.usage, Date.now());
    if (delay === undefined) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [usage, tick]);

  if (usage.kind === 'failed') {
    return (
      <a className="usage-meter usage-meter-failed" href="#/usage">
        <span aria-hidden="true" className="usage-meter-failed-mark">
          ■
        </span>
        <span role="alert">Usage could not be loaded</span>
      </a>
    );
  }

  if (usage.kind === 'loading') {
    return (
      <a
        className="usage-meter"
        href="#/usage"
        aria-busy="true"
        aria-label="Usage loading. Open the usage page."
      >
        <SkeletonGroup label="5-hour" valueWidth={120} />
        <SkeletonGroup label="Weekly" valueWidth={150} />
      </a>
    );
  }

  const now = new Date();
  const windows = windowsOf(usage.usage);
  const fiveHour = describeUsageWindow(windows.fiveHour, now);
  const sevenDay = describeUsageWindow(windows.sevenDay, now);

  return (
    <a
      className="usage-meter"
      href="#/usage"
      aria-label={`Usage: ${windowSummary('5-hour', fiveHour)}. ${windowSummary('Weekly', sevenDay)}. Open the usage page.`}
    >
      <WindowGroup label="5-hour" description={fiveHour} />
      <WindowGroup label="Weekly" description={sevenDay} />
    </a>
  );
}

function WindowGroup({
  label,
  description,
}: {
  readonly label: string;
  readonly description: UsageWindowDescription;
}) {
  if (description.noData) {
    return (
      <span className="usage-meter-group">
        <span className="label">{label}</span>
        <span aria-hidden="true" className="usage-meter-track usage-meter-track-empty" />
        <span className="usage-meter-muted">no data yet</span>
      </span>
    );
  }

  const groupClass = [
    'usage-meter-group',
    description.tone,
    description.resetting ? 'resetting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={groupClass}>
      <span className="label">{label}</span>
      <span aria-hidden="true" className="usage-meter-track">
        <span
          className="usage-meter-fill"
          style={{ width: `${description.utilizationPercent}%` }}
        />
        <span className="usage-meter-tick" />
      </span>
      <span className="usage-meter-value">{description.valueLabel}</span>
      {description.resetting ? (
        <span className="usage-meter-reset">
          <span aria-hidden="true" className="pulse">
            ●
          </span>
          resetting…
        </span>
      ) : (
        <span className="usage-meter-reset">{`resets ${description.resetLabel}`}</span>
      )}
    </span>
  );
}

function SkeletonGroup({
  label,
  valueWidth,
}: {
  readonly label: string;
  readonly valueWidth: number;
}) {
  return (
    <span className="usage-meter-group">
      <span className="label">{label}</span>
      <span aria-hidden="true" className="usage-meter-skeleton pulse" style={{ width: 72 }} />
      <span
        aria-hidden="true"
        className="usage-meter-skeleton pulse"
        style={{ width: valueWidth }}
      />
    </span>
  );
}

function windowSummary(label: string, description: UsageWindowDescription): string {
  if (description.noData) return `${label} no data yet`;
  if (description.resetting) return `${label} ${description.valueLabel}, resetting`;
  return `${label} ${description.valueLabel}, resets ${description.resetLabel}`;
}

function windowsOf(usage: UsageResponse) {
  if (usage.observedAt === null) return { fiveHour: null, sevenDay: null };
  return { fiveHour: usage.fiveHour, sevenDay: usage.sevenDay };
}

function msUntilNextReset(usage: UsageResponse, nowMs: number): number | undefined {
  const { fiveHour, sevenDay } = windowsOf(usage);
  const resets = [fiveHour, sevenDay]
    .flatMap((window) => (window === null ? [] : [new Date(window.resetsAt).getTime()]))
    .filter((resetMs) => resetMs > nowMs);
  if (resets.length === 0) return undefined;
  return Math.min(...resets) - nowMs;
}
