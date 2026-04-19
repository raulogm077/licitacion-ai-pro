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
        onConsoleLog: (log) => {
            if (log.includes('Error: Test error message') || log.includes('The above error occurred in the <ThrowingComponent> component')) {
                return false;
            }
        },
        coverage: {
            reporter: ['text', 'json', 'html'],
            thresholds: {
                // Raised in iteración E after adding tests for db/ai/template services.
                // Actual: 79.95% stmt / 66% branches / 72.94% fn / 80.81% lines.
                // History: baseline(65/50/58/65) → iterD(73/59/69/73) → iterE(79/65/72/80)
                statements: 79,
                branches: 65,
                functions: 72,
                lines: 80,
            },
        },
    },
});
