import { CommandBlock } from './command-block.js';

export type BannerTone = 'info' | 'warn' | 'danger';

type BannerProps = {
  readonly tone: BannerTone;
  readonly message: string;
  readonly command?: string;
  readonly hint?: string;
  readonly detail?: string;
  readonly pulses?: boolean;
};

const toneShapes: Readonly<Record<BannerTone, string>> = {
  info: '●',
  warn: '▲',
  danger: '■',
};

export function Banner({ tone, message, command, hint, detail, pulses = false }: BannerProps) {
  return (
    <div className={`banner ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className={pulses ? 'shape pulse' : 'shape'} aria-hidden="true">
        {toneShapes[tone]}
      </span>
      <p>{message}</p>
      {command !== undefined && <CommandBlock command={command} />}
      {hint !== undefined && <p className="sm">{hint}</p>}
      {detail !== undefined && <p className="sm mono">{detail}</p>}
    </div>
  );
}
