/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    pdf: ['jspdf', 'jspdf-autotable'],
                    excel: ['exceljs'],
                    ui: ['lucide-react', 'clsx', 'tailwind-merge', 'react-tooltip']
                }
            }
        },
        chunkSizeWarningLimit: 1000
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', 'e2e', '.idea', '.git', '.cache']
    }
})
