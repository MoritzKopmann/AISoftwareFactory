import type { DatabaseSync } from 'node:sqlite';
import type { UsageWindow, WindowUsage } from '../../business/domain/types/usage-window.js';
import type { UsageRepository } from '../../business/port/repository/usage-repository.js';

type UsageRow = {
  readonly five_hour_utilization: number | null;
  readonly five_hour_resets_at: string | null;
  readonly seven_day_utilization: number | null;
  readonly seven_day_resets_at: string | null;
  readonly observed_at: string | null;
  readonly paused_until: string | null;
};

function toWindowUsage(utilization: number | null, resetsAt: string | null): WindowUsage | null {
  return utilization === null || resetsAt === null
    ? null
    : { utilizationPercent: utilization, resetsAt };
}

export class SqliteUsageRepository implements UsageRepository {
  constructor(private readonly database: DatabaseSync) {}

  async find(): Promise<UsageWindow | undefined> {
    const row = this.database
      .prepare(
        `
        SELECT
          five_hour_utilization,
          five_hour_resets_at,
          seven_day_utilization,
          seven_day_resets_at,
          observed_at,
          paused_until
        FROM usage_window
        WHERE id = 1
      `,
      )
      .get() as unknown as UsageRow | undefined;

    return row === undefined
      ? undefined
      : {
          fiveHour: toWindowUsage(row.five_hour_utilization, row.five_hour_resets_at),
          sevenDay: toWindowUsage(row.seven_day_utilization, row.seven_day_resets_at),
          observedAt: row.observed_at,
          pausedUntil: row.paused_until,
        };
  }

  async save(window: UsageWindow): Promise<void> {
    this.database
      .prepare(
        `
        INSERT INTO usage_window (
          id,
          five_hour_utilization,
          five_hour_resets_at,
          seven_day_utilization,
          seven_day_resets_at,
          observed_at,
          paused_until
        )
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          five_hour_utilization = excluded.five_hour_utilization,
          five_hour_resets_at = excluded.five_hour_resets_at,
          seven_day_utilization = excluded.seven_day_utilization,
          seven_day_resets_at = excluded.seven_day_resets_at,
          observed_at = excluded.observed_at,
          paused_until = excluded.paused_until
      `,
      )
      .run(
        window.fiveHour?.utilizationPercent ?? null,
        window.fiveHour?.resetsAt ?? null,
        window.sevenDay?.utilizationPercent ?? null,
        window.sevenDay?.resetsAt ?? null,
        window.observedAt,
        window.pausedUntil,
      );
  }
}
