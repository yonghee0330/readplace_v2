import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * PWA: 빌드할 때만 dist/sw.js를 만든다. 템플릿(src/pwa/sw.template.js)에
 * 미리 캐시할 파일 목록(html·js·css·manifest·아이콘)과 버전을 채운다. 글꼴은 처음 쓸 때 캐시한다.
 */
function pwa(): Plugin {
  return {
    name: 'bbooks-pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => /\.(js|css|html)$/.test(f));
      const precache = ['./', ...files, 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
      const version = createHash('sha1').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const source = readFileSync('src/pwa/sw.template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify([...new Set(precache)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // 상대 경로라 GitHub Pages 하위 경로(/readplace_v2/)나 다른 정적 호스팅에서도 그대로 동작한다
  base: './',
  plugins: [pwa()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
