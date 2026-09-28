import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gateSkeleton } from '../../src/board/gate-skeleton.js';

describe('gateSkeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not show the skeleton before 300 ms of loading', () => {
    const handleVisibility = vi.fn();
    const gate = gateSkeleton(handleVisibility);

    gate.setLoading(true);
    vi.advanceTimersByTime(299);

    expect(handleVisibility).not.toHaveBeenCalled();
  });

  it('should show the skeleton after 300 ms of loading', () => {
    const handleVisibility = vi.fn();
    const gate = gateSkeleton(handleVisibility);

    gate.setLoading(true);
    vi.advanceTimersByTime(300);

    expect(handleVisibility).toHaveBeenLastCalledWith(true);
  });

  it('should never show the skeleton when loading ends within 300 ms', () => {
    const handleVisibility = vi.fn();
    const gate = gateSkeleton(handleVisibility);

    gate.setLoading(true);
    vi.advanceTimersByTime(200);
    gate.setLoading(false);
    vi.advanceTimersByTime(1000);

    expect(handleVisibility).not.toHaveBeenCalled();
  });

  it('should keep the skeleton for 500 ms when loading ends right after it appeared', () => {
    const handleVisibility = vi.fn();
    const gate = gateSkeleton(handleVisibility);

    gate.setLoading(true);
    vi.advanceTimersByTime(300);
    gate.setLoading(false);
    vi.advanceTimersByTime(499);
    expect(handleVisibility).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(1);

    expect(handleVisibility).toHaveBeenLastCalledWith(false);
  });

  it('should hide the skeleton at once when loading ends after it was shown for 500 ms', () => {
    const handleVisibility = vi.fn();
    const gate = gateSkeleton(handleVisibility);

    gate.setLoading(true);
    vi.advanceTimersByTime(300 + 800);
    gate.setLoading(false);

    expect(handleVisibility).toHaveBeenLastCalledWith(false);
  });

  it('should keep the skeleton when loading resumes before the minimum time is up', () => {
    const handleVisibility = vi.fn();
    const gate = gateSkeleton(handleVisibility);

    gate.setLoading(true);
    vi.advanceTimersByTime(300);
    gate.setLoading(false);
    gate.setLoading(true);
    vi.advanceTimersByTime(2000);

    expect(handleVisibility).toHaveBeenCalledTimes(1);
    expect(handleVisibility).toHaveBeenLastCalledWith(true);
  });

  it('should stop all timers after dispose', () => {
    const handleVisibility = vi.fn();
    const gate = gateSkeleton(handleVisibility);

    gate.setLoading(true);
    gate.dispose();
    vi.advanceTimersByTime(2000);

    expect(handleVisibility).not.toHaveBeenCalled();
  });
});
