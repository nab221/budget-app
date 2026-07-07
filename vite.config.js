import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages project-site base path (preserved from the previous config).
  base: '/budget-app/',
  plugins: [react()],
});
