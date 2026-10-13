import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

type LockFn = (() => void) | null;

const DELAY_MAP: Record<string, number> = {
  '30s': 30_000,
  '1min': 60_000,
  '5min': 300_000,
  '15min': 900_000,
  '30min': 1_800_000,
  '1h': 3_600_000,
};

export const useAutoLogout = (lockFn?: LockFn) => {
  const { signOut, user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDelay = useCallback(() => {
    const key = localStorage.getItem('auto_logout_delay') || 'off';
    return DELAY_MAP[key] ?? null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    const delay = getDelay();
    clearTimer();
    if (delay && user) {
      timerRef.current = setTimeout(() => {
        if (lockFn) {
          lockFn();
        } else {
          signOut();
        }
      }, delay);
    }
  }, [getDelay, clearTimer, user, signOut, lockFn]);

  useEffect(() => {
    if (!user) return;

    const delay = getDelay();
    if (!delay) return;

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimer();
    };
  }, [user, resetTimer, getDelay, clearTimer]);

  // Re-init when storage changes (e.g. from settings)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auto_logout_delay') resetTimer();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [resetTimer]);
};
