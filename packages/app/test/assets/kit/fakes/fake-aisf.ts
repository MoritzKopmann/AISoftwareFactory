import { vi } from 'vitest';
import { resetPageSession } from '../../../../assets/kit/support/page-session.js';

type StatusEvent = { status: 'open' | 'busy' | 'closed'; version: number };
type SendEvent = { kind: string; round: number; payload: unknown };
type SendResult = { ok: true } | { ok: false; status: 'busy' | 'closed' };

export class FakeAisf {
  draft: unknown = null;
  sendResult: SendResult = { ok: true };
  readonly saves: unknown[] = [];
  readonly sent: SendEvent[] = [];
  saveFails = false;
  private listeners: Array<(event: StatusEvent) => void> = [];

  readonly userInputState = {
    load: async (): Promise<unknown> => this.draft,
    save: async (value: unknown): Promise<void> => {
      if (this.saveFails) throw new Error('not reachable');
      this.saves.push(structuredClone(value));
    },
  };

  on(_event: 'status', listener: (event: StatusEvent) => void): void {
    this.listeners.push(listener);
  }

  send = async (event: SendEvent): Promise<SendResult> => {
    this.sent.push(structuredClone(event));
    return this.sendResult;
  };

  emitStatus(status: StatusEvent['status']): void {
    for (const listener of this.listeners) listener({ status, version: 1 });
  }

  get lastSave(): unknown {
    return this.saves[this.saves.length - 1];
  }
}

/** Starts a clean page: new session, empty body, optional fake bridge. Call in beforeEach. */
export function startPage(aisf: FakeAisf | undefined): void {
  resetPageSession();
  document.documentElement.removeAttribute('data-aisf-status');
  document.body.innerHTML = '';
  (window as unknown as { aisf: FakeAisf | undefined }).aisf = aisf;
}

/** Puts html on the page and lets loading and restoring finish. */
export async function mount(html: string): Promise<void> {
  document.body.innerHTML = html;
  await settle();
}

export async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

export function $<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`Not found: ${selector}`);
  return found;
}

export function $$<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return [...root.querySelectorAll<T>(selector)];
}

export async function click(element: Element): Promise<void> {
  (element as HTMLElement).click();
  await settle();
}

export async function type(
  input: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): Promise<void> {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}
