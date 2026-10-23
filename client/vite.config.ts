import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:4000";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      // In development, "/api/..." is forwarded to the Express backend.
      proxy: { "/api": { target: proxyTarget, changeOrigin: true } },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
