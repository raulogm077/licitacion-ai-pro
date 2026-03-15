## 2024-03-15 - [Optimize Tag Suggestions Filtering]
**Learning:** Filtering a suggestion list against an existing tag list using `.includes()` inside `.filter()` causes O(N*M) complexity. String case conversion inside the callback adds unnecessary overhead.
**Action:** Use a `Set` for O(1) lookups of existing items and hoist invariant case conversions outside the loop to optimize filtering operations.
