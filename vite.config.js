import { defineConfig } from 'vite'

export default defineConfig({
  // Needed because @hashgraph/sdk uses Node built-ins
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      // Some Hedera deps reference 'stream' / 'buffer' — polyfill them
      stream: 'stream-browserify',
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: [
      '@hashgraphonline/hashinal-wc',
      '@hashgraphonline/standards-sdk',
      '@hashgraph/sdk',
      '@hashgraph/hedera-wallet-connect',
    ],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
