import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api/functions": {
          target: env.VITE_SUPABASE_URL || "https://edwerzutsknhuplidhsj.supabase.co",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/functions/, "/functions/v1"),
        },
      },
    },
    plugins: [
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
