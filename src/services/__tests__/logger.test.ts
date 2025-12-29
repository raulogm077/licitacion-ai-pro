import { describe, it, expect, beforeEach } from 'vitest';
import { logger, useLoggerStore, LogLevel } from '../logger';

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

    it('should cap logs at 200', () => {
        for (let i = 0; i < 210; i++) {
            logger.info(`Log ${i}`);
        }

        const logs = useLoggerStore.getState().logs;
        expect(logs).toHaveLength(200);
        // Newest should be Log 209
        expect(logs[0].message).toBe('Log 209');
    });

    it('should clear logs', () => {
        logger.info('Test');
        expect(useLoggerStore.getState().logs).toHaveLength(1);

        useLoggerStore.getState().clearLogs();
        expect(useLoggerStore.getState().logs).toHaveLength(0);
    });
});
