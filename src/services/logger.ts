
import { create } from 'zustand';

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

export interface LogEntry {
    id: string;
    timestamp: number;
    level: LogLevel;
    message: string;
    data?: unknown;
}

interface LoggerStore {
    logs: LogEntry[];
    addLog: (level: LogLevel, message: string, data?: unknown) => void;
    clearLogs: () => void;
}

export const useLoggerStore = create<LoggerStore>((set) => ({
    logs: [],
    addLog: (level, message, data) => set((state) => ({
        logs: [
            {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                level,
                message,
                data
            },
            ...state.logs
        ].slice(0, 100) // Keep last 100 logs
    })),
    clearLogs: () => set({ logs: [] })
}));

export const logger = {
    info: (msg: string, data?: unknown) => useLoggerStore.getState().addLog(LogLevel.INFO, msg, data),
    warn: (msg: string, data?: unknown) => useLoggerStore.getState().addLog(LogLevel.WARN, msg, data),
    error: (msg: string, data?: unknown) => useLoggerStore.getState().addLog(LogLevel.ERROR, msg, data),
    debug: (msg: string, data?: unknown) => useLoggerStore.getState().addLog(LogLevel.DEBUG, msg, data),
};
