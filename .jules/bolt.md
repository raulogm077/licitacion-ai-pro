## 2026-01-14 - Optimize array filtering with Set lookup
**Performance Optimization:** Converted O(N*M) array `includes` filter operation to an O(N) operation by wrapping the filtered collection in a `Set` within a `useMemo` hook before iteration.
**Rationale:** Array `includes` executes a linear scan for every item in the outer array. Pre-computing a `Set` makes lookups O(1).
**Learning:** In React components, ensure that expensive standard data structure conversions, like creating a `Set`, are wrapped in `useMemo` to prevent unnecessary allocations and garbage collection overhead on every render.
