
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import basicAuthDev from "./viteBasicAuthDev";

interface Middleware {
  use: (middleware: any) => void;
}

interface Server {
  middlewares: Middleware;
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    ...(mode === 'development' && {
      middlewareMode: true,
      setupMiddlewares: (middlewares: any[], server: Server) => {
        // Attach Basic Auth middleware in dev
        server.middlewares.use(basicAuthDev);
        return middlewares;
      }
    }),
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
