// BCV exchange rate helpers: always two decimals, optionally rounded up to
// a whole number so it is easier to collect (36,47 → 37,00).
const ROUND_KEY = 'df_round_rate';

export const formatRate = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);

export const roundUpRate = (n: number): number => Math.ceil(Math.round(n * 100) / 100);

export function roundRatePreference(): boolean {
  try { return localStorage.getItem(ROUND_KEY) === '1'; } catch { return false; }
}

export function setRoundRatePreference(on: boolean) {
  try { localStorage.setItem(ROUND_KEY, on ? '1' : '0'); } catch {}
}

// The value to put in the form when the BCV rate arrives.
export const presentRate = (n: number): string => formatRate(roundRatePreference() ? roundUpRate(n) : n);
