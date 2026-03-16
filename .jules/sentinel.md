## 2025-03-05 - Insecure ID Generation via Math.random()
**Vulnerability:** Found `Math.random()` being used in conjunction with `Date.now()` to generate IDs for new notes in `src/components/domain/NotesPanel.tsx`. `Math.random()` is not cryptographically secure and can lead to predictable IDs or collisions.
**Learning:** Even for non-critical entities like UI notes, predictable ID generation exposes internal state generation mechanisms and violates secure coding standards. Modern environments (Node 22+, modern browsers) natively support `crypto.randomUUID()`.
**Prevention:** Always use `crypto.randomUUID()` for generating unique identifiers across the entire stack, avoiding custom implementations or `Math.random()`-based fallbacks.
