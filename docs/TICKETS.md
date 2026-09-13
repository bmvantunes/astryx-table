# Migration ticket draft

Status: approved by the user on 2026-09-08. Numbers below are plan IDs, not GitHub issue numbers.

1. **Audited core import and AstryxTable rename** — Blocked by: none. A traceable, non-published migration baseline that retains the existing domain behavior and tests.

2. **Virtual read-only Client with Astryx theme and menu** — Blocked by: 1. A real read-only Client grid with explicit identities, initial sorting, two-axis windowing and a published Astryx header menu.

3. **Pinned, RTL, resize and reorder parity** — Blocked by: 2. Pinned partitions and column-management gestures work in the new renderer.

4. **Keyboard and recycled-focus parity** — Blocked by: 2. Header/body navigation and overlays remain coherent as cells recycle.

5. **Filtering and persisted preferences** — Blocked by: 2, 4. Exact filters, non-empty sorting and sanitized durable preferences work through Astryx controls.

6. **Read-only Client grouping** — Blocked by: 5. Client groups, summaries and controls retain identity and presentation semantics.

7. **Server viewport and source lifecycle** — Blocked by: 2. A Server grid consumes authoritative sparse rows and presents source lifecycle correctly.

8. **Server filters and grouping** — Blocked by: 5, 7. Exact queries, facets and grouped results work end-to-end through the source adapter.

9. **Immediate editing and live confirmation** — Blocked by: 4. Editable cells save atomic changes and reconcile through live source evidence.

10. **Batch editing, history and conflicts** — Blocked by: 9. The edit footer, sparse history and conflict reviews support complete Batch workflows.

11. **Row and range selection with atomic copy** — Blocked by: 3, 4, 6. Client row selection and identity-stable linear ranges copy safely across virtual windows.

12. **Atomic paste and drag fill** — Blocked by: 9, 10, 11. Paste and repetition-only fill work through the new chrome without changing gesture atomicity.

13. **Theme, accessibility and custom-renderer parity audit** — Blocked by: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12. The complete successor passes its parity ledger under themes and user customizations.

14. **Performance and emitted-package release gates** — Blocked by: 13. A release candidate is proven from actual artifacts, ready for an explicitly authorized npm release.
