type LogArgs = unknown[];

const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

function write(method: (...args: LogArgs) => void, args: LogArgs) {
    if (isDev) {
        method(...args);
    }
}

export const logger = {
    info: (...args: LogArgs) => write(console.info, args),
    warn: (...args: LogArgs) => write(console.warn, args),
    error: (...args: LogArgs) => write(console.error, args),
};
