import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:45000,
  expect:{timeout:10000},
  use:{baseURL:'http://127.0.0.1:5173',channel:process.env.CI?undefined:'chrome',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}}],
  webServer:{command:'pnpm dev:local',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:60000},
});
