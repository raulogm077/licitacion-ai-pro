/**
 * A standardized Result type for handling success and failure states without throwing exceptions.
 */
export type Result<T, E = Error> = { ok: true; value: T; error?: never } | { ok: false; value?: never; error: E };

/**
 * Creates a successful result.
 */
export function ok<T, E = Error>(value: T): Result<T, E> {
    return { ok: true, value };
}

/**
 * Creates a failed result.
 */
export function err<T, E = Error>(error: E): Result<T, E> {
    return { ok: false, error };
}

/**
 * Type guard for checking if a result is successful.
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
    return result.ok;
}

/**
 * Type guard for checking if a result is a failure.
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return !result.ok;
}
