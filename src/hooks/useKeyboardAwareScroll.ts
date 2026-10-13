import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Activate the listeners (e.g. only on mobile when the form is open) */
  enabled: boolean;
  /** Pixels reserved for header + footer of the container (drawer/sheet chrome) */
  chromeOffset?: number;
}

/**
 * Robust mobile-keyboard handling using window.visualViewport.
 *
 * - Tracks visualViewport height + offsetTop to know the area actually visible
 *   above the on-screen keyboard.
 * - Exposes:
 *   - contentHeight: usable height for the scrollable content (chromeOffset removed)
 *   - contentPaddingBottom: extra bottom padding so the last fields can scroll into view
 *   - scrollToFocused: focus handler that centers the focused field above the keyboard
 *     with a fallback re-check (handles slow keyboards on Android).
 */
export function useKeyboardAwareScroll({ enabled, chromeOffset = 180 }: Options) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [contentPaddingBottom, setContentPaddingBottom] = useState<number>(16);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Re-center the currently focused element if it's hidden behind the keyboard
  const reposition = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    const container = containerRef.current;
    if (container && !container.contains(active)) return;

    const visibleTop = vv.offsetTop;
    const visibleBottom = vv.offsetTop + vv.height;
    const rect = active.getBoundingClientRect();
    const margin = 16;

    if (rect.bottom > visibleBottom - margin || rect.top < visibleTop + margin) {
      try {
        active.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        active.scrollIntoView();
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onChange = () => {
      const usable = vv.height - chromeOffset;
      setContentHeight(usable > 200 ? usable : 200);
      // Generous bottom padding so the last input can be scrolled to the center
      setContentPaddingBottom(Math.max(16, Math.round(vv.height * 0.5)));
      reposition();
    };

    onChange();
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
    };
  }, [enabled, chromeOffset, reposition]);

  // Focus handler — schedule scroll attempts to handle keyboards that open with delay
  const scrollToFocused = useCallback(
    (e: React.FocusEvent) => {
      const target = e.target as HTMLElement;
      const run = () => {
        const vv = window.visualViewport;
        if (!vv) {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        const rect = target.getBoundingClientRect();
        const visibleTop = vv.offsetTop;
        const visibleBottom = vv.offsetTop + vv.height;
        const margin = 16;
        if (rect.bottom > visibleBottom - margin || rect.top < visibleTop + margin) {
          try {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          } catch {
            target.scrollIntoView();
          }
        }
      };
      // Multiple attempts to cover slow / animated keyboards
      window.setTimeout(run, 100);
      window.setTimeout(run, 300);
      window.setTimeout(run, 600);
    },
    [],
  );

  return { containerRef, contentHeight, contentPaddingBottom, scrollToFocused };
}
