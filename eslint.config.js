import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

/**
 * Flat config (ESLint 9). Sustituye a `.eslintrc.cjs`.
 *
 * El conjunto de reglas efectivo es deliberadamente **el mismo** que el de la
 * configuración anterior: esta migración existe para desbloquear el ecosistema
 * de plugins, no para relajar la vara de medir. En particular
 * `@typescript-eslint/no-explicit-any` sigue en `error`.
 *
 * `pnpm lint` corre con `--max-warnings 0`, así que un `warn` también rompe el
 * build; la distinción warn/error se conserva por intención semántica.
 */
export default tseslint.config(
    // En flat config los ignores globales van en su propio bloque; ya no existe
    // `ignorePatterns`. `supabase/functions/**` queda fuera porque es código
    // Deno con su propio `deno check` y `deno lint` en el pipeline.
    {
        ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'supabase/functions/**'],
    },

    js.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/ban-ts-comment': 'warn',
        },
    }
);
