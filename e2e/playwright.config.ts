import { defineConfig } from '@playwright/test'

// フロント＋バック＋本物のDBを docker-compose.e2e.yml で起動した状態を前提に、
// ブラウザ操作でユーザージャーニーを検証する（run-e2e.sh が起動〜破棄を担当）。
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
})
