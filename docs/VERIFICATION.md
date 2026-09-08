# Verification status — 2026-09-08

## Verified

- TypeScript and production build.
- 14 automated SQL, catalog, import, encryption and restore checks: ownership isolation, direct mutation denial, concurrency, exact integers, retry behavior, allocations, cycles, six family claims, catalog version pinning/migration/rollback, export, imported unknown-value preservation and deletion replay after restore.
- Six desktop and phone browser journeys pass: onboarding, gear persistence across sessions, guided completion, journal, export, deletion, visible conflicts, offline sign-out, and imported gear reference comparisons and guide navigation offline.
- Eight hosted API checks with two disposable Supabase Auth accounts: guessed IDs and direct API denial, anonymous denial, persistence, concurrent HTTP 409, exact deductions/idempotency, export and actual Auth deletion.

Hosted fixture accounts use deliberately confirmed test identities. Those tests do not prove real email verification, recovery delivery or Google OAuth. Browser phone emulation does not prove native Android behavior.

## Outstanding acceptance gates

The owner selected a replacement backend, taxhvwhachtrhtcdbnsz. Earlier hosted test results apply to the previous backend only. See BACKEND-CUTOVER.md. The new project has the canonical URL and all eight callback URLs saved, but still needs schema and Edge Function installation through a reconnected connector.

Automated WCAG AA checks now pass on desktop and phone for sign-in, privacy, deletion and the authenticated gear reference. Footer/sidebar contrast was corrected; the shell has a keyboard skip link and main landmark, and compact touch controls have a 44-pixel minimum. Automated checks do not replace a full assistive-technology audit.

- Real mailbox verification/recovery and Google sign-in/linking on web and Android; hosted redirect URLs, SMTP and Auth signup hook configuration.
- Separate staging environment and real hosted encrypted backup/restore rehearsal; daily backup schedule and failure alerts enabled.
- Android SDK build, installation, keyboard/back/deep-link behavior and signed Play internal-track distribution.
- Live deployed browser journey after final service configuration, accessibility audit and final operator/privacy details.
- Enable leaked-password protection in Supabase Auth if available on the selected tier; the security advisor currently reports it disabled. Any required upgrade needs cost review first.

The latest deletion Edge Function passed the hosted smoke run. Its private Storage bucket contains the two disposable account tombstones, and both test Auth accounts were removed. Security advisors report three intentional deny-all private tables without policies and the Auth configuration warning above.

The latest production deployment is READY at https://www.blackdesertcompanion.app and its sign-in page opens in a real browser. Authenticated hosted browser journeys still depend on provider configuration and a real tester login.

Do not mark the invited beta complete until these are evidenced. No personal player records or credentials are included in source fixtures.
