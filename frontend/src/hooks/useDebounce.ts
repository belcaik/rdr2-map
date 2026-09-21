import { useState, useEffect } from "react";

/**
 * Debounce a value by the given delay in milliseconds.
 * Returns the latest value only after `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
