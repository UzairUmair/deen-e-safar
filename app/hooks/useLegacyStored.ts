"use client";
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { legacyStore } from "../services/account/legacyStorage";
import { getAccountUid, subscribeAccount } from "../services/account/accountStore";
export function useLegacyStored<T>(key: string, initial: T) {
  const fallback = useRef(initial);
  const store = useMemo(() => legacyStore(key, fallback.current), [key]);
  const owner = useSyncExternalStore(subscribeAccount, getAccountUid, () => null);
  const value = useSyncExternalStore(store.subscribe, store.get, store.server);
  const set = useCallback((next: T | ((value: T) => T)) => { store.set(next, owner); }, [store, owner]);
  return [value, set, true] as const;
}
