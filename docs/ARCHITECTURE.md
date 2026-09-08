# Architecture

The same React interface runs in a browser and a Capacitor Android WebView. Supabase Auth supplies the session. Public SQL wrappers are SECURITY INVOKER and call restricted private functions. Private tables have RLS and no client table-mutation grants. Ownership always comes from auth.uid(), verified email and the server-side allowlist; client IDs only select objects within that ownership boundary.

Each command includes a UUID request ID and expected account revision. The database locks the account, validates the entire ownership chain, checks the revision, applies all changes and records a receipt and journal event in one transaction. An identical retry returns the recorded result without spending or rewarding twice. Reusing a request ID with different content is rejected. Conflicts use PT409 so PostgREST returns HTTP 409 instead of automatically retrying serialization failures.

Quantities are PostgreSQL bigint values and decimal strings in JSON. Client calculations use BigInt. Reservations reduce availability, not ownership. Completion previews show deductions; reopening never automatically refunds resources or clears family claims. Dependency cycles are rejected. Catalog versions are immutable after review/publication; existing goals remain pinned until an explicit migration.

The query snapshot is cached per authenticated subject for offline reading. Writes require server acknowledgment. Logout and account switching clear private caches. The core route modules load with the app so offline navigation does not depend on a first-time network fetch.

Account deletion verifies the bearer token on the server. It writes a minimal UUID deletion tombstone to private Storage before deleting player records and the Auth account. The deletion ledger is outside the logical database backup scope, so a restore can reapply later deletions. See OPERATIONS.md for the limits and recovery procedure.
