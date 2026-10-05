import { defineConfig, devices } from "@playwright/test";

// Mismo puerto que `npm run dev`: Next 16 no permite dos `next dev` del mismo
// proyecto a la vez, así que en local se reutiliza el dev server que ya corre.
// Si en el 3000 hubiera OTRA app, el smoke test falla en rojo (verifica el título FALBER).
const PORT = 3000;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // En CI también se genera el reporte HTML: es el artefacto que sube el workflow si falla.
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  // Escritorio y celular: la compra termina en WhatsApp, el flujo clave es mobile.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // En CI la build corre en un paso propio del workflow; acá solo se levanta.
    command: isCI ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
