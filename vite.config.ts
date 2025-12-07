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
                    firebase: ['firebase/app', 'firebase/firestore', 'firebase/analytics'],
                    pdf: ['jspdf', 'jspdf-autotable'],
                    excel: ['xlsx'],
                    ui: ['lucide-react', 'clsx', 'tailwind-merge', 'react-tooltip']
                }
            }
        },
        chunkSizeWarningLimit: 1000
    }
})
