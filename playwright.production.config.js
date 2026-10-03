import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/production',
  outputDir:'./.qa/production',
  workers:1,
  use:{channel:'chromium',baseURL:'http://127.0.0.1:4176/action-workbench/',trace:'retain-on-failure'},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4176 --base /action-workbench/',url:'http://127.0.0.1:4176/action-workbench/',reuseExistingServer:!process.env.CI},
});
