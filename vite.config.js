import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend lives in ./frontend and builds into ./public, which the
// Express server serves. In dev, /api and /ws are proxied to the backend.
export default defineConfig({
  root: "frontend",
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
});
