// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const removeGoogleFonts = {
    name: "remove-google-fonts",
    enforce: "post",
    generateBundle(_, bundle) {
        for (const file of Object.values(bundle)) {
            if (file.type === "asset" && file.fileName.endsWith(".css")) {
                file.source = String(file.source).replace(
                    /@import\s*["']https:\/\/fonts\.googleapis\.com\/[^"']+["'];?/g,
                    ""
                );
            }
        }
    }
};

export default defineConfig({
  plugins: [react(), tailwindcss(), removeGoogleFonts],
  define: {
    global: 'globalThis',
    'process.env': {}, // suppress process.env crashes
  },
  resolve: {
    alias: {
      buffer: 'buffer', // required for web3.js
    },
  },
});
