import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['src/test/e2e/**', 'e2e/**', 'node_modules/**'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            thresholds: {
                statements: 65,
                branches: 50,
                functions: 58,
                lines: 65,
            },
        },
    },
});
