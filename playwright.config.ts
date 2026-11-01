import { defineConfig } from '@playwright/test';

// 헤드리스 WebGL은 소프트웨어 렌더링(SwiftShader)이라 느리다. 넉넉한 제한 시간을 둔다.
export default defineConfig({
  testDir: 'tests',
  timeout: 300_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1024, height: 700 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: [
    { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run server', port: 8787, reuseExistingServer: true, timeout: 30_000 },
  ],
});
