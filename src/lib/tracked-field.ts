/**
 * Utility to unwrap TrackedField values.
 * TrackedField wraps primitives in { value, status, evidence?, warnings? }.
 * This handles both wrapped and legacy raw values.
 */
export function unwrap<T>(field: T | { value: T } | null | undefined): T;
export function unwrap<T>(field: unknown, defaultValue: T): T;
export function unwrap<T>(field: unknown, defaultValue?: T): T {
    if (field === null || field === undefined) return (defaultValue ?? field) as T;
    if (typeof field === 'object' && field !== null && 'value' in field) {
        const val = (field as { value: T }).value;
        return val ?? (defaultValue as T);
    }
    return field as T;
}
