import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

function bundledFramesPlugin(): Plugin {
  const virtualId = 'virtual:bundled-frames';
  const resolvedId = '\0' + virtualId;
  const framesDir = fileURLToPath(new URL('./public/frames', import.meta.url));

  const generate = () => {
    let files: string[] = [];
    if (fs.existsSync(framesDir)) {
      files = fs.readdirSync(framesDir).filter((f) => /\.(png|webp)$/i.test(f) && !f.startsWith('.'));
    }
    files.sort((a, b) => a.localeCompare(b, 'ko'));
    const data = files.map((file) => {
      const id = file.replace(/\.[^.]+$/, '');
      return { id, name: id, url: `/frames/${encodeURIComponent(file)}` };
    });
    return `export const bundledFrameFiles = ${JSON.stringify(data)};`;
  };

  return {
    name: 'bundled-frames',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) return generate();
    },
    configureServer(server) {
      if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });
      server.watcher.add(framesDir);
    },
    handleHotUpdate({ file, server }) {
      const normalized = file.replace(/\\/g, '/');
      if (!normalized.includes('/public/frames/')) return;
      const mod = server.moduleGraph.getModuleById(resolvedId);
      if (mod) {
        server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), bundledFramesPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
