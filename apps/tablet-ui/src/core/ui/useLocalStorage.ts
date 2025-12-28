import { useEffect, useState } from "react";

/** Magyar komment: egyszerű localStorage hook, hogy megmaradjon a háttér választás */
export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // no-op
    }
  }, [key, value]);

  return [value, setValue] as const;
}
