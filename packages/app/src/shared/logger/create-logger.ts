export type LogLevel = 'info' | 'warn' | 'error';

export type LogSink = (level: LogLevel, message: string) => void;

export type Logger = {
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
};

export const consoleLogSink: LogSink = (level, message) => {
  console[level === 'info' ? 'log' : level](message);
};

export function createLogger(sink: LogSink): Logger {
  return {
    info: (message) => sink('info', message),
    warn: (message) => sink('warn', message),
    error: (message) => sink('error', message),
  };
}
