# BDO Companion

Android and web companion for Black Desert Online PC, NA/EU. React, TypeScript, Vite, Capacitor and Supabase. No bundled player records become new accounts' data.

## Run locally

Use Node 24 and pnpm 11.19.0.

    pnpm install --frozen-lockfile
    pnpm dev:local

Open http://127.0.0.1:5173. The development banner identifies the local PostgreSQL-compatible PGlite harness. Sign in with explorer@local.test / LocalExplorer123! or create a local account. The harness implements the real SQL mutations, but its email inbox and authentication are development substitutes. Its persistent database lives in the ignored .local directory. It never connects to hosted player data.

For the full Supabase stack, install Docker, run pnpm db:start, then pnpm db:reset on the local project. Copy .env.example to .env.local and use the local URL/public key printed by Supabase. Run pnpm dev. Verification and recovery messages appear in the local inbox on port 54324. Do not run a database reset against beta.

For hosted development, .env.local needs VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and VITE_APP_URL; see .env.example for the exact supported names. Use only public keys in VITE variables.

## Implemented

- Verified-account and server-enforced tester access; resumable family/character onboarding.
- Persistent gear, resources, goals, dependencies, reservations, transaction previews and journal adjustments.
- Exact integer quantities, optimistic revisions, idempotent retries and atomic reward transactions.
- Versioned guide catalog with protected review, publish, rollback and migration preview.
- Offline read-only data, private-cache clearing, export and account deletion.
- Capacitor Android project, native login return handling, back navigation and original installation assets.
- Searchable 250-row gear reference and 12-section PvE guide from the owner's documents, including enhancement comparisons, provenance and review flags.
- Encrypted backup/restore utilities and deletion replay safeguards.

## Verification

    pnpm check
    pnpm test:e2e
    pnpm android:sync

SQL, catalog, encryption and restore tests use isolated databases. Browser tests cover desktop and phone layouts. Hosted smoke scripts create disposable test fixtures; use them only on the explicitly selected test environment. Never put their generated credentials in version control.

Read [deployment](docs/DEPLOYMENT.md), [operations](docs/OPERATIONS.md), [architecture](docs/ARCHITECTURE.md) and [verification status](docs/VERIFICATION.md) before inviting testers. Google OAuth, production email, a separate staging project, a real hosted restore rehearsal and signed Android distribution remain release gates.
