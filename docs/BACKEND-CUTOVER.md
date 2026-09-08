# Requested backend switch — 2026-09-08

The owner selected project taxhvwhachtrhtcdbnsz (bdo-companion-database, Black Desert Developers) to replace vcxptrbumythgwzpgybr. The new project is healthy and currently reports no migrations. Its public browser configuration is prepared in ignored .env.next-backend. The live frontend has not been switched yet: doing so before schema installation would break access.

Required sequence:

Already configured and verified in the new project's dashboard: canonical Site URL https://www.blackdesertcompanion.app and eight exact callbacks for www, apex, Vercel and Android (callback and reset for each). The read-only preflight confirms email enabled, email confirmation required, Google disabled and the companion_snapshot RPC absent. Public configuration is ready, but the live cutover remains pending schema/function installation.

1. Connect the Supabase connector to taxhvwhachtrhtcdbnsz and verify its project URL. The previous connector currently returns a permission error.
2. Inspect tables, apply all five existing migrations in order, install the reviewed catalog seed and administrator allowlist entry, and deploy delete-account with its import map and JWT verification enabled.
3. Configure the canonical site URL, exact web/native callbacks, Before User Created hook, verified email, Google provider and SMTP on the new project. Previous project settings do not transfer automatically.
4. Run node --env-file=.env.next-backend scripts/check-backend.mjs, then the two-account hosted smoke suite against the new project. Confirm exact deductions, conflict responses, private Storage tombstones and deletion.
5. Replace .env.local with the checked new public configuration, build, deploy and verify the actual site. Update CI environment variables and deployment documentation.

Existing accounts and player records are not migrated by this procedure. A data migration requires a separately reviewed export/import and identity plan; do not silently copy player data or reuse old Auth sessions. No old project data is deleted.

Reconnection diagnostic: Codex's automatic OAuth scope discovery was rejected by Supabase during client registration. Explicit supported scopes (organizations:read, projects:read, database:read, database:write, edge_functions:read, edge_functions:write, analytics:read) completed sign-in successfully. The current task's already-running connector still returns Insufficient scope; reload the connector/task before retrying migrations. This is an authorization-session refresh issue, not a database migration failure. No schema was installed by the rejected calls.
