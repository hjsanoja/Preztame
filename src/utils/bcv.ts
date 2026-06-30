/**
 * Utility to fetch the official BCV (Banco Central de Venezuela) exchange rate (USD to VES)
 * using our secure server-side API proxy to avoid CORS restrictions, with local client-side fallbacks.
 */

export async function fetchBCVExchangeRate(): Promise<number | null> {
  // Primary attempt: Use our server-side proxy which does not suffer from CORS
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('/api/bcv', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    clearTimeout(id);

    if (response.ok) {
      const data = await response.json();
      if (data?.success && data?.rate) {
        const rate = parseFloat(data.rate);
        if (!isNaN(rate) && rate > 0) {
          console.log(`Successfully fetched BCV rate from server-side proxy: ${rate}`);
          return rate;
        }
      }
    }
  } catch (error) {
    console.warn("Server proxy BCV fetch failed, trying direct fallback...", error);
  }

  // Fallback 1: Direct client-side call to DolarAPI (may fail due to CORS in some clients)
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    clearTimeout(id);

    if (response.ok) {
      const data = await response.json();
      const rate = data?.promedio || data?.venta || data?.compra;
      if (rate) {
        const num = parseFloat(rate);
        if (!isNaN(num) && num > 0) {
          console.log(`Successfully fetched BCV rate from client-side fallback: ${num}`);
          return num;
        }
      }
    }
  } catch (error) {
    console.warn("Client-side direct BCV fallback failed:", error);
  }

  return null;
}
