import { useEffect, useMemo, useState } from 'react';
import { chartTokens } from '../theme.js';

/**
 * Chart tokens that stay in sync with the live theme. Canvas charts can't
 * read CSS variables, so they bake colours in at render time — this hook
 * re-resolves them when the explicit theme changes (`data-theme` on <html>)
 * or the OS flips `prefers-color-scheme` while the dashboard is open.
 */
export function useChartTokens() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const bump = () => setVersion((v) => v + 1);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', bump);
    const observer = new MutationObserver(bump);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      mq?.removeEventListener?.('change', bump);
      observer.disconnect();
    };
  }, []);

  // `version` is the re-resolve trigger — the tokens themselves come from CSS.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => chartTokens(), [version]);
}

export default useChartTokens;
