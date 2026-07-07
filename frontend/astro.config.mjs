import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.PUBLIC_API_URL || 'http://localhost:3000')
    }
  }
});
