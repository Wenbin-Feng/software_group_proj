import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          if (moduleId.includes('node_modules')) {
            if (moduleId.includes('pdfjs-dist')) return 'pdf';
            if (/markdown|remark|micromark|mdast|hast|unified/.test(moduleId)) {
              return 'markdown';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
