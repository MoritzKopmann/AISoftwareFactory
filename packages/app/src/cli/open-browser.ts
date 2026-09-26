import { spawn } from 'node:child_process';

export function openBrowser(url: string): void {
  const opener = spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
  opener.on('error', () => {
    console.log(`Open ${url} in your browser`);
  });
  opener.unref();
}
