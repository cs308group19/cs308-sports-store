import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    // The backend runs on :3000 (see backend/.env). Same-origin calls avoid CORS in development.
    proxy: { "/api": "http://localhost:3000" },
  },
});
