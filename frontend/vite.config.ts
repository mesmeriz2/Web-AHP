import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // .env / .env.local 을 루트 디렉터리에서 직접 로드 (process.env 타이밍 문제 우회)
  const env = loadEnv(mode, "..", "");

  const hmrDisabled = env.VITE_HMR_DISABLED === "true";
  const hmrHost = env.VITE_HMR_HOST?.trim();
  const hmrPort = env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : 0;
  const useProxyHmr = Boolean(hmrHost && Number.isFinite(hmrPort) && hmrPort > 0);

  const proxyApiTarget =
    env.VITE_PROXY_API_TARGET || "http://backend:8000";

  return {
    plugins: [react()],
    envDir: "..",
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
      hmr: hmrDisabled ? false : useProxyHmr ? { protocol: "wss", host: hmrHost, clientPort: hmrPort } : true,
      proxy: {
        "/api": {
          target: proxyApiTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              const location = proxyRes.headers["location"];
              if (typeof location === "string" && location.startsWith(proxyApiTarget)) {
                proxyRes.headers["location"] = location.slice(proxyApiTarget.length);
              }
            });
          },
        },
      },
    },
  };
});
