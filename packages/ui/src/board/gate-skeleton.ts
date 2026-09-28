const showAfterMilliseconds = 300;
const visibleAtLeastMilliseconds = 500;

export type SkeletonGate = {
  readonly setLoading: (loading: boolean) => void;
  readonly dispose: () => void;
};

export function gateSkeleton(onVisibilityChange: (visible: boolean) => void): SkeletonGate {
  let visible = false;
  let shownAt = 0;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const show = () => {
    showTimer = undefined;
    visible = true;
    shownAt = Date.now();
    onVisibilityChange(true);
  };

  const hide = () => {
    hideTimer = undefined;
    visible = false;
    onVisibilityChange(false);
  };

  const clearTimers = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = undefined;
    hideTimer = undefined;
  };

  return {
    setLoading(loading) {
      clearTimers();
      if (loading) {
        if (!visible) {
          showTimer = setTimeout(show, showAfterMilliseconds);
        }
        return;
      }
      if (!visible) {
        return;
      }
      const remainingMilliseconds = visibleAtLeastMilliseconds - (Date.now() - shownAt);
      if (remainingMilliseconds <= 0) {
        hide();
      } else {
        hideTimer = setTimeout(hide, remainingMilliseconds);
      }
    },
    dispose: clearTimers,
  };
}
