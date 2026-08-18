import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ["5173-iqzvoujaz6wicttdu1y4u-6cb4feab.us4.manus.computer"]
  },
  build: { sourcemap: true }
});
