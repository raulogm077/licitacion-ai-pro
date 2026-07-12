import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                // "Iris" — primary indigo→violet identity
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1', // Primary
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                    950: '#1e1b4b',
                },
                // Accent — violet, for highlights and the signature gradient
                accent: {
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    200: '#ddd6fe',
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    800: '#5b21b6',
                    900: '#4c1d95',
                },
                // Semantic colors
                success: {
                    light: '#d1fae5',
                    DEFAULT: '#10b981',
                    dark: '#047857',
                },
                warning: {
                    light: '#fef3c7',
                    DEFAULT: '#f59e0b',
                    dark: '#b45309',
                },
                danger: {
                    light: '#ffe4e6',
                    DEFAULT: '#f43f5e',
                    dark: '#be123c',
                },
                // Legacy corporate tokens — still referenced by the dashboard
                // sidebar/placeholder; removed when those are rebranded (F3).
                navy: {
                    DEFAULT: '#001C3D',
                    mid: '#002A5C',
                    light: '#003B7A',
                },
                cyan: {
                    DEFAULT: '#00E5FF',
                    muted: '#00B8CC',
                },
                sidebar: {
                    DEFAULT: '#001C3D',
                    foreground: '#F5F7FA',
                    accent: '#002A5C',
                    border: '#003B7A',
                },
            },
            fontFamily: {
                sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk Variable', 'Space Grotesk', 'Inter Variable', 'ui-sans-serif', 'sans-serif'],
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            boxShadow: {
                // Soft product elevation + colored glow for primary CTAs
                card: '0 1px 3px 0 rgb(15 23 42 / 0.04), 0 4px 20px -6px rgb(15 23 42 / 0.08)',
                'card-hover': '0 8px 32px -8px rgb(79 70 229 / 0.18), 0 2px 8px -2px rgb(15 23 42 / 0.08)',
                glow: '0 0 0 1px rgb(99 102 241 / 0.12), 0 10px 30px -8px rgb(99 102 241 / 0.45)',
                'glow-lg': '0 0 0 1px rgb(99 102 241 / 0.14), 0 20px 50px -12px rgb(124 58 237 / 0.5)',
            },
            backgroundImage: {
                'brand-gradient': 'linear-gradient(110deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'slide-up': {
                    '0%': { transform: 'translateY(12px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                shimmer: {
                    '100%': { transform: 'translateX(100%)' },
                },
                'progress-indeterminate': {
                    '0%': { left: '-40%', width: '40%' },
                    '50%': { left: '20%', width: '60%' },
                    '100%': { left: '100%', width: '40%' },
                },
                aurora: {
                    '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
                    '33%': { transform: 'translate3d(3%,-4%,0) scale(1.08)' },
                    '66%': { transform: 'translate3d(-3%,3%,0) scale(0.96)' },
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: '0.6' },
                    '50%': { opacity: '1' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.5s ease-out both',
                'slide-up': 'slide-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
                shimmer: 'shimmer 1.6s infinite',
                'progress-indeterminate': 'progress-indeterminate 1.4s ease-in-out infinite',
                aurora: 'aurora 18s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
            },
        },
    },
    plugins: [tailwindcssAnimate],
};
