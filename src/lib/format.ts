// Dollars without decimals when the amount is whole, with cents otherwise.
export function formatUsd(n: number): string {
  const whole = Math.abs(n % 1) < 0.005;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2
  }).format(n);
}

// Compact axis labels: $1.2k, $15k.
export function formatUsdCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `$${Math.round(n)}`;
}

export function formatVes(n: number): string {
  return `Bs. ${new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(n)}`;
}

export const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
