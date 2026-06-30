import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route for BCV exchange rate with sequential multiple reliable sources
  app.get("/api/bcv", async (req, res) => {
    console.log("API: Fetching BCV rate requested...");
    
    // List of fetchers to run sequentially until one succeeds
    const fetchers = [
      // 1. Try Dolar API (oficial)
      async () => {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`DolarAPI status ${response.status}`);
        const data = await response.json();
        const rate = data?.promedio || data?.venta || data?.compra;
        if (rate) {
          const num = parseFloat(rate);
          if (!isNaN(num) && num > 0) return num;
        }
        throw new Error("Invalid rate format in DolarAPI");
      },
      
      // 2. Try pyDolarVenezuela
      async () => {
        const response = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`pyDolar status ${response.status}`);
        const data = await response.json();
        const bcv = data?.monitors?.bcv || data?.bcv;
        const rate = bcv?.price || data?.price;
        if (rate) {
          const num = parseFloat(rate);
          if (!isNaN(num) && num > 0) return num;
        }
        throw new Error("Invalid rate format in pyDolar");
      },

      // 3. Scrape BCV website directly (robust regex matching)
      async () => {
        const response = await fetch('https://www.bcv.org.ve/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
          },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) throw new Error(`BCV Scrape status ${response.status}`);
        const text = await response.text();
        
        // Match <div id="dolar"> ... <strong> 36.42 </strong>
        const match = text.match(/id=["']dolar["'][\s\S]*?<strong>\s*([0-9.,]+)\s*<\/strong>/i);
        if (match && match[1]) {
          const rawRate = match[1].replace(',', '.').trim();
          const num = parseFloat(rawRate);
          if (!isNaN(num) && num > 0) return num;
        }

        // Alternative match
        const altMatch = text.match(/id=["']dolar["'][\s\S]*?([0-9]{2,}[.,][0-9]{2,})/i);
        if (altMatch && altMatch[1]) {
          const rawRate = altMatch[1].replace(',', '.').trim();
          const num = parseFloat(rawRate);
          if (!isNaN(num) && num > 0) return num;
        }
        
        throw new Error("Could not parse rate from BCV HTML");
      },

      // 4. Try Dolar API general list
      async () => {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`DolarAPI list status ${response.status}`);
        const data = await response.json();
        if (Array.isArray(data)) {
          const oficial = data.find(item => item?.nombre?.toLowerCase() === 'oficial' || item?.oficial);
          const rate = oficial?.promedio || oficial?.venta || oficial?.compra || data[0]?.promedio;
          if (rate) {
            const num = parseFloat(rate);
            if (!isNaN(num) && num > 0) return num;
          }
        }
        throw new Error("Invalid rate format in DolarAPI list");
      }
    ];

    let finalRate: number | null = null;
    let errors: string[] = [];

    for (let i = 0; i < fetchers.length; i++) {
      try {
        finalRate = await fetchers[i]();
        if (finalRate !== null) {
          console.log(`API SUCCESS: Sourced rate ${finalRate} from fetcher index ${i}`);
          break;
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn(`Fetcher index ${i} failed:`, errMsg);
        errors.push(`Fetcher ${i}: ${errMsg}`);
      }
    }

    if (finalRate !== null) {
      // Set headers to prevent caching of exchange rate
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.json({ success: true, rate: finalRate });
    } else {
      console.error("API ERROR: All BCV rate fetchers failed.", errors);
      return res.status(500).json({ 
        success: false, 
        error: "No se pudo obtener la tasa oficial del BCV", 
        details: errors 
      });
    }
  });

  // Serve static files in production, configure Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
