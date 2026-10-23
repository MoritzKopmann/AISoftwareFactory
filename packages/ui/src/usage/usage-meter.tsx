import { useEffect, useState } from 'react';
import type { UsageResponse } from '@aisf/app/api-schemas/usage-schemas.js';
import { describeUsageWindow, type UsageWindowDescription } from './describe-usage-window.js';
import type { UsageState } from './use-usage.js';
import { windowsOf } from './usage-windows.js';

const VALUE_SKELETON_WIDTH_PIXELS = 36;
const FIVE_HOUR_RESET_SKELETON_WIDTH_PIXELS = 96;
const WEEKLY_RESET_SKELETON_WIDTH_PIXELS = 128;

export function UsageMeter({
  usage,
  current,
}: {
  readonly usage: UsageState;
  readonly current: boolean;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (usage.kind !== 'loaded') return;
    const delay = msUntilNextReset(usage.usage, Date.now());
    if (delay === undefined) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), delay);
    return () => window.clearTimeout(timer);
  }, [usage, tick]);

  const ariaCurrent = current ? 'page' : undefined;

  if (usage.kind === 'failed') {
    return (
      <a className="usage-meter usage-meter-failed" href="#/usage" aria-current={ariaCurrent}>
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
        aria-current={ariaCurrent}
        aria-label="Usage loading. Open the usage page."
      >
        <SkeletonGroup label="5-hour" resetWidth={FIVE_HOUR_RESET_SKELETON_WIDTH_PIXELS} />
        <SkeletonGroup label="Weekly" resetWidth={WEEKLY_RESET_SKELETON_WIDTH_PIXELS} />
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
      aria-current={ariaCurrent}
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
        <span className="usage-meter-head">
          <span className="label">{label}</span>
          <span className="usage-meter-muted">no data yet</span>
        </span>
        <span aria-hidden="true" className="usage-meter-track usage-meter-track-empty" />
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
      <span className="usage-meter-head">
        <span className="label">{label}</span>
        <span className="usage-meter-value">{description.valueLabel}</span>
      </span>
      <span aria-hidden="true" className="usage-meter-track">
        <span
          className="usage-meter-fill"
          style={{ width: `${description.utilizationPercent}%` }}
        />
        <span className="usage-meter-tick" />
      </span>
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
  resetWidth,
}: {
  readonly label: string;
  readonly resetWidth: number;
}) {
  return (
    <span className="usage-meter-group">
      <span className="usage-meter-head loading">
        <span className="label">{label}</span>
        <span
          aria-hidden="true"
          className="usage-meter-skeleton pulse"
          style={{ width: VALUE_SKELETON_WIDTH_PIXELS }}
        />
      </span>
      <span aria-hidden="true" className="usage-meter-skeleton pulse" />
      <span
        aria-hidden="true"
        className="usage-meter-skeleton usage-meter-skeleton-reset pulse"
        style={{ width: resetWidth }}
      />
    </span>
  );
}

function windowSummary(label: string, description: UsageWindowDescription): string {
  if (description.noData) return `${label} no data yet`;
  if (description.resetting) return `${label} ${description.valueLabel}, resetting`;
  return `${label} ${description.valueLabel}, resets ${description.resetLabel}`;
}

function msUntilNextReset(usage: UsageResponse, nowMs: number): number | undefined {
  const { fiveHour, sevenDay } = windowsOf(usage);
  const resets = [fiveHour, sevenDay]
    .flatMap((window) => (window === null ? [] : [new Date(window.resetsAt).getTime()]))
    .filter((resetMs) => resetMs > nowMs);
  if (resets.length === 0) return undefined;
  return Math.min(...resets) - nowMs;
}
