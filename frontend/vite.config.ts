import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hmrHost = process.env.VITE_HMR_HOST?.trim();
const hmrPort = process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : 0;
const useProxyHmr = Boolean(hmrHost && Number.isFinite(hmrPort) && hmrPort > 0);

// 시놀로지 역프록시가 프론트엔드로만 보낼 때 /api를 백엔드로 전달. Docker 기본값: backend:8000
const proxyApiTarget =
  process.env.VITE_PROXY_API_TARGET !== undefined && process.env.VITE_PROXY_API_TARGET !== ""
    ? process.env.VITE_PROXY_API_TARGET
    : "http://backend:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // 역프록시(mem.photos:15175) 경유 시 Host 헤더 검사로 400 방지
    allowedHosts: true,
    // 역프록시 HMR은 host+port가 모두 설정된 경우에만 활성화
    hmr: useProxyHmr ? { protocol: "wss", host: hmrHost, clientPort: hmrPort } : true,
    // 상대 경로(/api) 요청이 같은 origin으로 올 때 백엔드로 프록시 (시놀로지 역프록시가 프론트만 받는 경우)
    proxy: {
      "/api": {
        target: proxyApiTarget,
        changeOrigin: true,
      },
    },
  },
});
