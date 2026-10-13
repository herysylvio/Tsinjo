import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system' | 'neon' | 'nature' | 'ocean';

const PREMIUM_THEMES = ['neon', 'nature', 'ocean'] as const;

const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('theme') as Theme) || 'dark';
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;

  // Remove all premium theme classes
  PREMIUM_THEMES.forEach((t) => root.classList.remove(`theme-${t}`));

  if (PREMIUM_THEMES.includes(theme as any)) {
    // Premium themes are dark-based
    root.classList.add('dark');
    root.classList.add(`theme-${theme}`);
  } else if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem('theme', t);
    setThemeState(t);
  };

  const isPremium = PREMIUM_THEMES.includes(theme as any);

  return { theme, setTheme, isPremium };
};
