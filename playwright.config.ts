import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    timeout: 600000, // 60s -> 60s (fixed typo in thought, explicit 60s globally)
    expect: {
        timeout: 10000,
    },
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        actionTimeout: 15000,
        navigationTimeout: 30000,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: './node_modules/.bin/vite preview --host 127.0.0.1 --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
