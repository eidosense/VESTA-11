# 🌌 VESTA-11 — Full-Stack 3D Astronomical & Generative AI Engine

A full-stack spatial web application combining high-precision astronomical computation, real-time 3D WebGL rendering, and Google Gemini generative AI pipelines.

### Key Capabilities
- **Precision Spatial & Astronomical Engine:** Integrates `astronomy-engine` for real-time celestial mechanics and coordinate calculations.
- **Interactive 3D Visualization:** Renders dynamic, hardware-accelerated 3D scenes directly in the browser using `Three.js` and `React Three Fiber`.
- **AI Synthesis & Insights:** Connects to Google Gemini (`@google/genai`) to translate complex spatial/astronomical states into structured, context-aware interpretations.
- **Full-Stack TypeScript Architecture:** Custom `Express` backend bundled with `esbuild`, paired with a `Vite` + `React 19` frontend and `Firebase` integration.

### Tech Stack
- **Backend & Build:** Node.js, Express, TypeScript, esbuild, Vite 6
- **AI & Cloud:** Google Gemini SDK (`@google/genai`), Firebase
- **3D & Computation:** Three.js, React Three Fiber (`@react-three/fiber`, `@react-three/drei`), `astronomy-engine`
- **UI & Styling:** React 19, Tailwind CSS v4, Motion

### Getting Started
```bash
npm install
npm run dev
