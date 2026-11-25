import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Feste Zeitzone, damit Tests mit Uhrzeiten überall gleich laufen
    env: { TZ: "Europe/Berlin" },
  },
})
