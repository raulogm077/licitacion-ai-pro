/**
 * Test factory for creating TrackedField wrappers.
 * Use `tf(value)` to create a TrackedField with default 'extraido' status.
 */
export function tf<T>(value: T) {
    return { value, status: 'extraido' as const };
}
