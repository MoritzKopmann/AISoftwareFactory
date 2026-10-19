import { query } from '@anthropic-ai/claude-agent-sdk';
import { UsageReadFailedError } from '../../business/errors/usage-read-failed-error.js';
import type { WindowUsage } from '../../business/domain/types/usage-window.js';
import type { UsageReader, UsageReading } from '../../business/port/sdk/usage-reader.js';

type SdkWindow =
  { readonly utilization: number | null; readonly resets_at: string | null } | null | undefined;

export type ClaudeAgentSdkUsageReaderOptions = {
  readonly claudeExecutablePath: string;
};

export class ClaudeAgentSdkUsageReader implements UsageReader {
  constructor(private readonly options: ClaudeAgentSdkUsageReaderOptions) {}

  async read(): Promise<UsageReading> {
    // The control request needs a live query. An empty prompt stream starts none and costs no tokens.
    const sdkQuery = query({
      prompt: (async function* () {})(),
      options: {
        settingSources: [],
        persistSession: false,
        pathToClaudeCodeExecutable: this.options.claudeExecutablePath,
      },
    });

    let response;
    try {
      // Experimental SDK method: only this adapter may call it.
      response = await sdkQuery.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({
        skipBehaviors: true,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UsageReadFailedError(`Usage read failed: ${reason}`);
    } finally {
      sdkQuery.close();
    }

    return {
      fiveHour: toWindowUsage(response.rate_limits?.five_hour),
      sevenDay: toWindowUsage(response.rate_limits?.seven_day),
    };
  }
}

function toWindowUsage(window: SdkWindow): WindowUsage | null {
  if (window?.utilization == null || window.resets_at == null) {
    return null;
  }
  return { utilizationPercent: window.utilization, resetsAt: window.resets_at };
}
