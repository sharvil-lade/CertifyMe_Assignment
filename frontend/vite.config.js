import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: '/CertifyMe_Assignment/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/signup": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/login": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/forgot-password": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/session": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/logout": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/opportunities": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
