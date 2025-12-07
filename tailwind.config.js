/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9', // Primary Brand Blue
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49',
                },
                // Semantic colors
                success: {
                    light: '#d1fae5', // emerald-100
                    DEFAULT: '#10b981', // emerald-500
                    dark: '#047857', // emerald-700
                },
                warning: {
                    light: '#fef3c7', // amber-100
                    DEFAULT: '#f59e0b', // amber-500
                    dark: '#b45309', // amber-700
                },
                danger: {
                    light: '#ffe4e6', // rose-100
                    DEFAULT: '#f43f5e', // rose-500
                    dark: '#be123c', // rose-700
                }
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-up': 'slideUp 0.4s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}
