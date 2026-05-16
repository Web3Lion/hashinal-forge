import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: ["n84jjd-5173.csb.app", ".csb.app"],
  },
  define: {
    global: "globalThis",
    "process.env": {},
  },
  resolve: {
    alias: {
      stream: "stream-browserify",
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    include: [
      "@hashgraphonline/hashinal-wc",
      "@hashgraphonline/standards-sdk",
      "@hashgraph/sdk",
      "@hashgraph/hedera-wallet-connect",
    ],
    esbuildOptions: {
      target: "es2020",
    },
  },
  build: {
    target: "es2020",
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
