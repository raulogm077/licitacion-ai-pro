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
                    ui: ['lucide-react', 'clsx', 'tailwind-merge']
                }
            }
        },
        chunkSizeWarningLimit: 1000
    },
    server: {
        proxy: {
            '/api': {
                target: process.env.VITE_API_URL || 'https://licitacion-ai-pro.vercel.app',
                changeOrigin: true,
                secure: false,
            }
        }
    }
});
