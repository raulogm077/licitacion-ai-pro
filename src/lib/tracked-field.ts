/**
 * Utility to unwrap TrackedField values.
 * TrackedField wraps primitives in { value, status, evidence?, warnings? }.
 * This handles both wrapped and legacy raw values.
 */
export function unwrap<T>(field: T | { value: T } | null | undefined): T {
    if (field === null || field === undefined) return field as T;
    if (typeof field === 'object' && field !== null && 'value' in field) {
        return (field as { value: T }).value;
    }
    return field as T;
}
