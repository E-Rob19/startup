import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // During development the React app runs on Vite's server (5173) and the
    // backend runs separately (4000). Forwarding /api requests to the backend
    // lets the frontend call fetch('/api/...') exactly as it will in
    // production, where one server on 4000 serves both.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
