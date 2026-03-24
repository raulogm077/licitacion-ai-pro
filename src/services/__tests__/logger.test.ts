import { describe, it, expect, beforeEach } from 'vitest';
import { logger, useLoggerStore, LogLevel, perfTracker } from '../logger';

describe('Logger Service', () => {
    beforeEach(() => {
        useLoggerStore.getState().clearLogs();
    });

    it('should add logs', () => {
        logger.info('Info message');
        logger.error('Error message');

        const logs = useLoggerStore.getState().logs;
        expect(logs).toHaveLength(2);
        expect(logs[0].message).toBe('Error message'); // LIFO (newest first)
        expect(logs[0].level).toBe(LogLevel.ERROR);
        expect(logs[1].message).toBe('Info message');
    });

    it('should log warn messages', () => {
        logger.warn('Warning', { code: 123 });
        const logs = useLoggerStore.getState().logs;
        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(LogLevel.WARN);
        expect(logs[0].data).toEqual({ code: 123 });
    });

    it('should log error with Error instance', () => {
        logger.error('Crash', new Error('boom'));
        const logs = useLoggerStore.getState().logs;
        expect(logs[0].data).toBeInstanceOf(Error);
    });

    it('should log perf messages with context', () => {
        logger.perf('render', { duration: 50 }, { component: 'App', duration: 50 });
        const logs = useLoggerStore.getState().logs;
        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(LogLevel.PERF);
        expect(logs[0].context?.component).toBe('App');
    });

    it('should log with context', () => {
        logger.info('action', undefined, { userId: 'u1', action: 'click' });
        const logs = useLoggerStore.getState().logs;
        expect(logs[0].context?.userId).toBe('u1');
    });

    it('should cap logs at 200', () => {
        for (let i = 0; i < 210; i++) {
            logger.info(`Log ${i}`);
        }

        const logs = useLoggerStore.getState().logs;
        expect(logs).toHaveLength(200);
        expect(logs[0].message).toBe('Log 209');
    });

    it('should clear logs', () => {
        logger.info('Test');
        expect(useLoggerStore.getState().logs).toHaveLength(1);

        useLoggerStore.getState().clearLogs();
        expect(useLoggerStore.getState().logs).toHaveLength(0);
    });
});

describe('PerformanceTracker', () => {
    beforeEach(() => {
        useLoggerStore.getState().clearLogs();
    });

    it('tracks start and end of a measurement', () => {
        perfTracker.start('test-op');
        perfTracker.end('test-op', { component: 'TestComp' });

        const logs = useLoggerStore.getState().logs;
        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe(LogLevel.PERF);
        expect(logs[0].message).toContain('test-op');
        expect(logs[0].context?.duration).toBeGreaterThanOrEqual(0);
    });

    it('does nothing if end called without start', () => {
        perfTracker.end('nonexistent');
        expect(useLoggerStore.getState().logs).toHaveLength(0);
    });
});
