/**
 * Official BCV (Banco Central de Venezuela) USD → VES exchange rate.
 *
 * The app is hosted as static files (GitHub Pages), so there is no server
 * proxy. We try DolarAPI directly from the browser first and fall back to the
 * user's own Apps Script (`?action=bcv`), which fetches it server-side.
 */
import { fetchBcvFromScript } from '../lib/sheetsApi';
import { getStoredSheetUrl, getStoredToken } from './storage';

async function fetchDolarApi(): Promise<number | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const rate = parseFloat(data?.promedio || data?.venta || data?.compra);
    return rate > 0 ? rate : null;
  } catch (error) {
    console.warn('DolarAPI BCV fetch failed:', error);
    return null;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchBCVExchangeRate(): Promise<number | null> {
  const direct = await fetchDolarApi();
  if (direct) return direct;
  return fetchBcvFromScript({ url: getStoredSheetUrl(), token: getStoredToken() });
}
