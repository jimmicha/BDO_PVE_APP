# Release verification — 2026-09-11

This supersedes the deployment and browser-access limitations in earlier checkpoint documents. The full release is still incomplete.

## Verified

- Fresh checkout from `jimmicha/BDO_PVE_APP`, starting at `d1db184c99eeeb8429a8da8d55882401d844353c`. Original workspace preserved.
- Production `https://www.blackdesertcompanion.app` now uses Supabase `taxhvwhachtrhtcdbnsz`. Production-only Vite environment variables were saved in Vercel and rebuilt. No player data was migrated or deleted.
- Auth fix `6a2176a` is deployed: Google offers account selection; OAuth callback failures and missing sessions display actionable errors.
- Real Google login succeeded with the owner's invited account. Discord `jim_mich` was linked with explicit owner confirmation, then a separate sign-out/Discord sign-in succeeded. Database and Settings show both providers on the same account.
- Password recovery was requested from Settings and its message appeared in the intended Gmail inbox. The recovery link/password-change journey was not exercised.
- Latest `pnpm check`: 25 tests plus typecheck and production build passed. Baseline Playwright: 12 journeys passed. New OAuth callback regression coverage: 6 browser cases passed.
- Android debug APK rebuilt from the deployed auth fix: Gradle BUILD SUCCESSFUL (244 tasks). This is build verification, not device acceptance.
- Owner created separate free staging project `boqojknvrfddtrvpmgap` (`bdo-companion-staging`, Ireland). All ten migrations and reviewed v1 seed applied; invitation hook, email confirmation, manual identity linking and JWT-protected deletion function configured. Security/performance advisors report no warnings or errors. The ten hosted acceptance checks passed, including real fixture Auth, isolation, concurrency, spending, export and deletion. Fixtures were removed: zero users, profiles, families and invitations remain. Test deletion tombstones intentionally remain.
- Read-only production availability checks passed for web origin, email/Google/Discord configuration and the exact anonymous RPC permission denial. Six regression tests reject false-positive health results. A six-hour GitHub workflow is prepared; its first hosted run still needs verification.

## Remaining release gates

1. Complete the 70-row ladder review and correct its transaction semantics before publication. See `CATALOG-REVIEW-2026-09-11.md`. Version 1 remains the live reviewed catalog.
2. Finish Android emulator/device acceptance: OAuth return links, keyboard/back navigation, offline behavior, export/share, deletion and accessibility. Emulator image download was interrupted and has been resumed; no connected physical device was found.
3. Owner confirmed there is no Play developer account or upload keystore. Signed AAB and Play internal distribution are pending. No paid enrollment or signing identity has been created.
4. Staging backend acceptance is complete. Hosted frontend, real staging OAuth/SMTP and restore rehearsal remain pending. The fresh checkout's CLI is linked to staging; every remote command also supplies its explicit project reference. Production-scoped Supabase MCP tools remain separate.
5. Activate encrypted backups only after secure credential setup, a successful manual backup, and a hosted restore rehearsal. The existing workflow is disabled; its presence does not provide backups. Monitoring and backup-freshness alert delivery also remain unverified.

## Operational notes

- No new spending authorized. Keep the existing project and production records intact.
- The production frontend before cutover was unconfigured; rolling back to it would restore that defect. Prefer the working cutover deployment or a tested forward fix.
- Capacitor-generated Gradle files contain machine-specific dependency paths after local sync; do not commit those path changes.
- Store keys/passwords in secret storage, never in this document or chat. Public frontend configuration belongs in Vercel/GitHub variables; service credentials do not.
