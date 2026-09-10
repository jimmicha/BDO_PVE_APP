# Continuation plan — 2026-09-10

The core beta is not release-complete. This checkpoint contains local implementation and test results, not a production cutover.

## Completed in this checkpoint

- Existing equipment can be edited with manually entered resource costs. A preview shows the item change and exact before/spent/remaining quantities; confirmation pins the preview revision.
- One database transaction updates the same equipment ID, deducts costs, records before/after history and writes the retry receipt. Invalid resources, other families, reservations, stale revisions and repeated request IDs are checked.
- The backend advertises equipment_costs_v1 only after the transaction migration is installed. Older backends do not show the new deduction controls.
- Local databases now apply subsequent migrations on restart. Checksums reject edited history; failed migrations roll back. Untracked older schemas are recognized against historical definitions, indexes, columns, constraints, permissions and policies before baselining. Saved player data is retained.
- The supplied 70-step ladder remains a draft. Manual equipment transactions do not turn its unknown costs or conversion rules into verified mechanics.

## Next implementation work, in order

1. ~~**Restore hosted access and finish the requested backend.**~~ Done 2026-09-10: all ten migrations applied in order to taxhvwhachtrhtcdbnsz, the reviewed v1 seed installed and published, an admin beta_members allowlist entry set, delete-account deployed with its import map and JWT verification enabled, and advisors show only expected informational findings. See PATCH_NOTES.txt and docs/BACKEND-CUTOVER.md for the full record.
2. **Run the new-project acceptance suite before cutover.** Execute the public preflight with .env.next-backend, prepare disposable test fixtures, run the two-account hosted smoke suite with HOSTED_TEST_PROJECT_REF=taxhvwhachtrhtcdbnsz, and extend it to cover equipment costs and advertised capability. Confirm direct API isolation, exact deductions, concurrency, export, deletion and private deletion ledger. Only then switch .env.local, build and deploy the website; rebuild Android assets afterward.
3. **Finish guided equipment conversions.** Define explicit catalog semantics for acquire versus upgrade/convert, required source item(s), allowed source enhancement, resulting item and whether assignment survives. Add source selection and a complete transaction preview to Roadmap. Reject incompatible, foreign, reused or missing inputs. Apply deductions, equipment changes, step completion and claims atomically. Reopen must not refund or duplicate equipment. Add retry, rollback, migration and two-slot tests. The current manual Gear transaction is a foundation, not this entire feature.
4. **Review the ladder before publication.** Verify every new stage against current official PC NA/EU evidence plus a second current reference. Resolve unknown costs, set rewards, both ring/earring slots, class conditions and theoretical targets. Preserve existing template/claim identities. Set review dates only after review; preview migrations of existing goals before applying them.
5. ~~**Configure real authentication.**~~ Provider setup done 2026-09-10: Google and Discord OAuth are both enabled (confirmed live against /auth/v1/settings), and Resend SMTP is verified working — a real signup against a temporary allowlisted address returned 200 with a genuine confirmation_sent_at, then was fully deleted (auth.users, identities, beta_members) with no residue. The Before User Created hook was independently confirmed: an unlisted email correctly got "This beta is invitation-only." The frontend already offers Google, Discord and email/password sign-in plus in-app linking. Remaining: click through the actual Google and Discord consent screens with a real browser (not just confirm the provider is enabled), verify recovery email delivery to a real inbox, and test system-browser Android return links on a device/emulator — none of which are possible from this remote session.
6. **Release and operations.** Create separate staging, configure encrypted daily seven-day backups and monitoring, rehearse a hosted restore with subsequent deletions reapplied, and finalize operator/privacy information. Test Android on a device/emulator, keyboard/back/offline/exports/deletion/accessibility, then produce a signed AAB and distribute through Play internal testing once signing/account configuration is available.

## Resume checks

- Read PATCH_NOTES.txt and this file, then inspect git status and current tool availability.
- Local development: pnpm dev:local. Production configuration is intentionally still unchanged.
- Validation: pnpm check and pnpm exec playwright test. Local tests use an Auth stand-in; they do not certify real Google/SMTP or Android journeys.
- Migration files are immutable after application. Add another migration for subsequent SQL changes.
- No purchase, production account migration, or old-project deletion is authorized by this checkpoint.
