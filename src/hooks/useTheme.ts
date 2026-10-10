import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'df_theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const resolve = (pref: ThemePreference): ResolvedTheme =>
  pref === 'system' ? (media()?.matches ? 'dark' : 'light') : pref;

// Applies the theme to <html data-theme> and the browser/status-bar color.
function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const surface = getComputedStyle(root).getPropertyValue('--md-surface').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface || '#f8fafd');
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readPreference()));

  useEffect(() => {
    apply(preference);
    setResolved(resolve(preference));
    if (preference !== 'system') return;
    const m = media();
    const onChange = () => { apply('system'); setResolved(resolve('system')); };
    m?.addEventListener?.('change', onChange);
    return () => m?.removeEventListener?.('change', onChange);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    try { localStorage.setItem(KEY, pref); } catch {}
    setPreferenceState(pref);
  }, []);

  return { preference, resolved, setPreference };
}

// Reads chart colors from the CSS tokens of the active theme.
export function readChartColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    series: [1, 2, 3, 4, 5, 6, 7, 8].map(i => v(`--series-${i}`)),
    seq: [1, 2, 3, 4].map(i => v(`--seq-${i}`)),
    grid: v('--chart-grid'),
    axis: v('--chart-axis'),
    muted: v('--chart-muted'),
    ink: v('--md-on-surface'),
    inkVariant: v('--md-on-surface-variant'),
    surface: v('--md-surface-lowest'),
    surfaceHigh: v('--md-surface-high'),
    outline: v('--md-outline-variant'),
    success: v('--md-success'),
    error: v('--md-error')
  };
}
export type ChartColors = ReturnType<typeof readChartColors>;
