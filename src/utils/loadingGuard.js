export const startLoadingTimeoutGuard = (onTimeout, timeoutMs = 8000) => {
  if (typeof window === 'undefined') {
    return () => true;
  }

  let released = false;
  const safeOnTimeout = typeof onTimeout === 'function' ? onTimeout : () => {};

  const timerId = window.setTimeout(() => {
    if (released) return;
    released = true;
    safeOnTimeout();
  }, Math.max(1000, Number(timeoutMs) || 8000));

  return () => {
    if (released) return false;
    released = true;
    window.clearTimeout(timerId);
    return true;
  };
};
