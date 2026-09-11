# Backups, recovery and monitoring

The included scripts are operator utilities; no daily hosted schedule is active yet. Run on a protected machine with PostgreSQL 17 client tools. Keep DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY and a 64-character hexadecimal BACKUP_KEY in secret storage. Losing the encryption key makes backups unrecoverable.

The GitHub workflow .github/workflows/backups.yml is prepared for 03:23 UTC daily. It remains disabled until repository variable BACKUPS_ENABLED is true and the beta-backups environment has the documented secrets plus SUPABASE_URL. Run it manually first and inspect the encrypted artifacts. GitHub artifacts retain seven days; enable workflow failure notifications and independently monitor freshness. The selected runner must provide PostgreSQL 17 tools; the job fails explicitly if they are absent. No secret values are included in the repository.

## Daily backup

Run scripts/reconcile-deletions.mjs, scripts/backup.mjs, then scripts/export-deletion-ledger.mjs using Node. The backup utility uses pg_dump custom format for auth, public, app_private and supabase_migrations; encrypts the database and tombstone snapshot using AES-256-GCM; and retains seven days of matching local encrypted files. Export the independent Storage deletion ledger with SUPABASE_URL and the server-only service key. Copy encrypted output to durable storage with seven-day retention. Alert on any failed run or missing daily artifact. Never retain plaintext temporary dumps.

Keep the independent deletion ledger available beyond the oldest retained backup. Its private Storage bucket is companion-deletion-ledger. Do not restore that bucket from an old snapshot when restoring the logical database. A complete Supabase project loss requires a separately preserved fresh ledger; database backups alone do not recover Storage, provider settings or deployed functions.

## Restore rehearsal

1. Disable application access and make a fresh export of the independent deletion ledger before changing a database.
2. Restore into an isolated staging project first. Set RESTORE_DATABASE_URL, BACKUP_FILE, DELETION_LEDGER_FILE, BACKUP_KEY and RESTORE_TARGET_CONFIRM to the exact destination hostname/database.
3. Run node scripts/restore.mjs. It decrypts the archive, restores in a transaction, then reapplies every later account deletion before access is reopened. A failure means access must remain disabled.
4. Verify account isolation, exact balances, reservations, equipment, journal, Auth sign-in and catalog versions. Confirm an account deleted after the backup cannot sign in or recover data. Reconcile pending Auth deletions and rerun hosted smoke tests.
5. Record the archive timestamp, deletion-ledger timestamp, recovery duration and results. A PGlite rehearsal passes in the automated tests; a real hosted pg_dump/pg_restore rehearsal is still required.

## Monitoring and rollback

The `Production availability` GitHub workflow runs every six hours and can be dispatched manually. It uses only the repository's public Vite variables and checks the web response, expected OAuth providers, email confirmation and the exact anonymous snapshot denial. Missing RPCs, invalid keys and server errors fail the check. GitHub Actions notification settings determine who receives failures; inbox notification delivery and backup freshness are separate acceptance checks. The workflow does not certify signed-in journeys or database restore safety.

Check the web origin, Auth health, Edge Function errors, database errors, backup freshness and catalog review expiry. Avoid logging tokens, passwords or player snapshots. Run Supabase advisors after schema changes. Use Vercel's previous deployment for frontend rollback; use catalog rollback for guide changes. Do not reverse database migrations blindly after player writes. Back up and review a forward correction.

Before public testing, identify the operator and support contact in the privacy page, finalize data retention notices and verify the deletion page from a signed-out browser.
