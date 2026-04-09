import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['src/test/e2e/**', 'node_modules/**'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            thresholds: {
                // Thresholds raised from original baseline (65/50/58/65) to reflect
                // improved coverage after iteración D. Target 80% in next iteration.
                statements: 73,
                branches: 59,
                functions: 69,
                lines: 73,
            },
        },
    },
});
