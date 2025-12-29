
import { create } from 'zustand';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG',
    PERF = 'PERF' // New: Performance metrics
}

export interface LogEntry {
    id: string;
    timestamp: number;
    level: LogLevel;
    message: string;
    data?: unknown;
    context?: LogContext; // New: Structured context
}

export interface LogContext {
    userId?: string;
    sessionId?: string;
    component?: string;
    action?: string;
    duration?: number; // For performance logs
    [key: string]: unknown;
}

interface LoggerStore {
    logs: LogEntry[];
    addLog: (level: LogLevel, message: string, data?: unknown, context?: LogContext) => void;
    clearLogs: () => void;
}

export const useLoggerStore = create<LoggerStore>((set) => ({
    logs: [],
    addLog: (level, message, data, context) => set((state) => ({
        logs: [
            {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                level,
                message,
                data,
                context
            },
            ...state.logs
        ].slice(0, 200)  // Increased from 100 to 200
    })),
    clearLogs: () => set({ logs: [] })
}));

// Performance tracking utility
class PerformanceTracker {
    private startTimes: Map<string, number> = new Map();

    start(label: string): void {
        this.startTimes.set(label, performance.now());
    }

    end(label: string, context?: Omit<LogContext, 'duration'>): void {
        const startTime = this.startTimes.get(label);
        if (startTime) {
            const duration = performance.now() - startTime;
            logger.perf(`${label} completed`, { duration }, { ...context, duration });
            this.startTimes.delete(label);
        }
    }
}

export const perfTracker = new PerformanceTracker();

// Check if we are in a test environment
const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

// Enhanced logger with structured logging
export const logger = {
    info: (msg: string, data?: unknown, context?: LogContext) => {
        useLoggerStore.getState().addLog(LogLevel.INFO, msg, data, context);
        if (import.meta.env.DEV && !isTest) console.log(`[INFO] ${msg}`, data, context);
    },

    warn: (msg: string, data?: unknown, context?: LogContext) => {
        useLoggerStore.getState().addLog(LogLevel.WARN, msg, data, context);
        if (!isTest) console.warn(`[WARN] ${msg}`, data, context);
    },

    error: (msg: string, data?: unknown, context?: LogContext) => {
        useLoggerStore.getState().addLog(LogLevel.ERROR, msg, data, context);
        if (!isTest) console.error(`[ERROR] ${msg}`, data, context);

        // In production, send to Sentry
        if (import.meta.env.PROD && !isTest && typeof window !== 'undefined') {
            import('../config/sentry').then(({ Sentry }) => {
                Sentry.captureException(data instanceof Error ? data : new Error(msg), {
                    contexts: { custom: context as Record<string, unknown> },
                    extra: { data }
                });
            }).catch((err) => {
                console.warn('Sentry not available:', err);
            });
        }
    },

    debug: (msg: string, data?: unknown, context?: LogContext) => {
        if (import.meta.env.DEV && !isTest) {
            useLoggerStore.getState().addLog(LogLevel.DEBUG, msg, data, context);
            console.debug(`[DEBUG] ${msg}`, data, context);
        }
    },

    perf: (msg: string, data?: unknown, context?: LogContext) => {
        useLoggerStore.getState().addLog(LogLevel.PERF, msg, data, context);
        if (import.meta.env.DEV && !isTest) {
            console.log(`[PERF] ${msg}`, data, context);
        }
    }
};
