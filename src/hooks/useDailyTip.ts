import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const CACHE_PREFIX = 'daily-tip-';

function getTodayKey() {
  return CACHE_PREFIX + new Date().toISOString().split('T')[0];
}

function cleanOldKeys() {
  const todayKey = getTodayKey();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX) && key !== todayKey) {
      localStorage.removeItem(key);
    }
  }
}

export function useDailyTip() {
  const { user } = useAuth();
  const [tip, setTip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const todayKey = getTodayKey();
    const cached = localStorage.getItem(todayKey);

    if (cached) {
      setTip(cached);
      setIsLoading(false);
      cleanOldKeys();
      return;
    }

    let cancelled = false;

    const fetchTip = async () => {
      try {
        // Force a token refresh to avoid expired JWT
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-tip`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({}),
          }
        );

        if (!response.ok) throw new Error('Failed');

        const data = await response.json();
        if (!cancelled && data.tip) {
          setTip(data.tip);
          localStorage.setItem(todayKey, data.tip);
          cleanOldKeys();
        }
      } catch {
        // fallback: tip stays null, Dashboard uses static text
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTip();
    return () => { cancelled = true; };
  }, [user]);

  return { tip, isLoading };
}
