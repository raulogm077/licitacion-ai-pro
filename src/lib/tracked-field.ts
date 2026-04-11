/**
 * Utility to unwrap TrackedField values.
 * TrackedField wraps primitives in { value, status, evidence?, warnings? }.
 * This handles both wrapped and legacy raw values.
 */
// NOTE: return type is T but can be undefined at runtime when field is null/undefined and no defaultValue is supplied.
// Callers that pass null/undefined without a defaultValue should handle potential undefined themselves.
export function unwrap<T>(field: T | { value: T } | null | undefined): T; // intentional: callers expect T, runtime may return undefined
export function unwrap<T>(field: unknown, defaultValue: T): T;
export function unwrap<T>(field: unknown, defaultValue?: T): T {
    if (field === null || field === undefined) return (defaultValue ?? field) as T;
    if (typeof field === 'object' && field !== null && 'value' in field) {
        const val = (field as { value: T }).value;
        return val ?? (defaultValue as T);
    }
    return field as T;
}
