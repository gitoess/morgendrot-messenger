import { defineConfig, devices } from '@playwright/test';

/**
 * UI-Browser-Tests.
 * - chromium: statisches ui/ (webServer: npx serve ui -l 3341), siehe e2e/ui.spec.ts
 * - lite-ui / messenger-ui: UI_BASE_URL oder http://127.0.0.1:3342 – ohne laufenden Server werden Tests übersprungen
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: process.env.UI_BASE_URL || 'http://127.0.0.1:3341',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: [/lite-ui\.spec\.ts$/, /messenger-ui\.spec\.ts$/],
        },
        {
            name: 'lite-ui',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: process.env.UI_BASE_URL || 'http://127.0.0.1:3342',
            },
            testMatch: /lite-ui\.spec\.ts/,
        },
        {
            name: 'messenger-ui',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: process.env.UI_BASE_URL || 'http://127.0.0.1:3342',
            },
            testMatch: /messenger-ui\.spec\.ts/,
        },
    ],
    timeout: 20000,
    expect: { timeout: 5000 },
    webServer: process.env.UI_BASE_URL
        ? undefined
        : {
              command: 'npx serve ui -l 3341',
              url: 'http://127.0.0.1:3341',
              reuseExistingServer: true,
              timeout: 15000,
          },
});
