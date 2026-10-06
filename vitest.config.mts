import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resuelve el alias @/* de tsconfig.json (nativo desde Vite 8).
  resolve: { tsconfigPaths: true },
  test: {
    // jsdom por defecto (componentes, localStorage del carrito).
    // Un test puro puede pedir Node con: // @vitest-environment node
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Solo tests unitarios: las specs de Playwright viven en e2e/ y usan otra API.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
