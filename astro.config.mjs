import { defineConfig } from 'astro/config';
export default defineConfig({ output: 'static', base: process.env.FOLIO_BASE || '/', site: process.env.FOLIO_SITE || 'http://localhost:4321' });
