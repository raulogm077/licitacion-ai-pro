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
        minWorkers: 1,
        maxWorkers: 2,
        coverage: {
            reporter: ['text', 'json', 'html'],
            thresholds: {
                // Raised after covering the dashboard view-model guidance branches
                // (pliego-vm) and the chapter render contract (chapter-config).
                // Actual: 82.61% stmt / 71.31% branches / 82.03% fn / 83.44% lines.
                // History: baseline(65/50/58/65) → iterD(73/59/69/73) → iterE(79/65/72/80)
                //          → iterF(82/70/81/83)
                statements: 82,
                branches: 70,
                functions: 81,
                lines: 83,
            },
        },
    },
});
