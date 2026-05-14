import { useEffect, useState } from "react";

const useCrmDebouncedValue = (value, delayMs = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), Math.max(Number(delayMs) || 0, 0));
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
};

export default useCrmDebouncedValue;
