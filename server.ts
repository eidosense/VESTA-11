import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { MoonPhase, Body, Observer } from 'astronomy-engine';

const SINGULARITY_DATE = new Date('2026-03-11T20:00:00Z');

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/celestial-sync", (req, res) => {
    const now = new Date();
    
    // Calculate current moon data
    const moonPhase = MoonPhase(now) / 360;
    const illumination = (1 - Math.cos(moonPhase * 2 * Math.PI)) / 2;
    
    // Calculate singularity moon data
    const singularityMoonPhase = MoonPhase(SINGULARITY_DATE) / 360;
    
    // Check alignment (simplified: same moon phase within 5% or same fire sign vibe)
    // In a real engine, we'd check zodiac signs more precisely
    const isAligned = Math.abs(moonPhase - singularityMoonPhase) < 0.05;

    res.json({
      now: {
        date: now.toISOString(),
        moonPhase,
        illumination,
      },
      singularity: {
        date: SINGULARITY_DATE.toISOString(),
        moonPhase: singularityMoonPhase,
      },
      isAligned,
      message: isAligned ? "Sync Alert: Cosmic resonance detected. The stars are mirroring the Singularity." : null
    });
  });

  // Vite middleware for development
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
