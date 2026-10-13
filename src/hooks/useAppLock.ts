import { useState, useCallback, useEffect } from 'react';

const PIN_HASH_KEY = 'app_pin_hash';
const LOCKED_KEY = 'app_locked';

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_tsinjo_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const useAppLock = () => {
  const [isLocked, setIsLocked] = useState(() => {
    return localStorage.getItem(LOCKED_KEY) === 'true' && !!localStorage.getItem(PIN_HASH_KEY);
  });

  const [hasPinSet, setHasPinSet] = useState(() => !!localStorage.getItem(PIN_HASH_KEY));

  const setPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    localStorage.setItem(PIN_HASH_KEY, hash);
    setHasPinSet(true);
  }, []);

  const removePin = useCallback(() => {
    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem(LOCKED_KEY);
    setHasPinSet(false);
    setIsLocked(false);
  }, []);

  const lock = useCallback(() => {
    if (localStorage.getItem(PIN_HASH_KEY)) {
      localStorage.setItem(LOCKED_KEY, 'true');
      setIsLocked(true);
    }
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash) return true;
    const inputHash = await hashPin(pin);
    if (inputHash === storedHash) {
      localStorage.removeItem(LOCKED_KEY);
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash) return false;
    const inputHash = await hashPin(pin);
    return inputHash === storedHash;
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCKED_KEY) {
        setIsLocked(e.newValue === 'true');
      }
      if (e.key === PIN_HASH_KEY) {
        setHasPinSet(!!e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { isLocked, hasPinSet, setPin, removePin, lock, unlock, verifyPin };
};
