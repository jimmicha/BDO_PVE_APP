# Continuation plan — 2026-09-10

The core beta is not release-complete. This checkpoint contains local implementation and test results, not a production cutover.

## Completed in this checkpoint

- Existing equipment can be edited with manually entered resource costs. A preview shows the item change and exact before/spent/remaining quantities; confirmation pins the preview revision.
- One database transaction updates the same equipment ID, deducts costs, records before/after history and writes the retry receipt. Invalid resources, other families, reservations, stale revisions and repeated request IDs are checked.
- The backend advertises equipment_costs_v1 only after the transaction migration is installed. Older backends do not show the new deduction controls.
- Local databases now apply subsequent migrations on restart. Checksums reject edited history; failed migrations roll back. Untracked older schemas are recognized against historical definitions, indexes, columns, constraints, permissions and policies before baselining. Saved player data is retained.
- The supplied 70-step ladder remains a draft. Manual equipment transactions do not turn its unknown costs or conversion rules into verified mechanics.

## Next implementation work, in order

1. **Restore hosted access and finish the requested backend.** Use taxhvwhachtrhtcdbnsz, never the previous project by accident. Inspect actual migration history first: only the core migration has been confirmed there. Apply all remaining migrations in order, including both equipment-cost migrations, then the reviewed v1 seed, owner administrator allowlist entry and delete-account function. Run database advisors and resolve findings. The Supabase connector is absent from this session; the browser fallback also failed to load its request-header policy. No hosted changes were attempted through an unverified connection.
2. **Run the new-project acceptance suite before cutover.** Execute the public preflight with .env.next-backend, prepare disposable test fixtures, run the two-account hosted smoke suite with HOSTED_TEST_PROJECT_REF=taxhvwhachtrhtcdbnsz, and extend it to cover equipment costs and advertised capability. Confirm direct API isolation, exact deductions, concurrency, export, deletion and private deletion ledger. Only then switch .env.local, build and deploy the website; rebuild Android assets afterward.
3. **Finish guided equipment conversions.** Define explicit catalog semantics for acquire versus upgrade/convert, required source item(s), allowed source enhancement, resulting item and whether assignment survives. Add source selection and a complete transaction preview to Roadmap. Reject incompatible, foreign, reused or missing inputs. Apply deductions, equipment changes, step completion and claims atomically. Reopen must not refund or duplicate equipment. Add retry, rollback, migration and two-slot tests. The current manual Gear transaction is a foundation, not this entire feature.
4. **Review the ladder before publication.** Verify every new stage against current official PC NA/EU evidence plus a second current reference. Resolve unknown costs, set rewards, both ring/earring slots, class conditions and theoretical targets. Preserve existing template/claim identities. Set review dates only after review; preview migrations of existing goals before applying them.
5. **Configure real authentication.** Configure the tester signup hook, Google OAuth, verified SMTP sender and secure identity linking on the new project. Verify email signup, recovery, Google linking and system-browser Android return links with real test accounts. The owner has not yet supplied a sender domain or Google provider configuration. Present a concrete cost review before any purchase.
6. **Release and operations.** Create separate staging, configure encrypted daily seven-day backups and monitoring, rehearse a hosted restore with subsequent deletions reapplied, and finalize operator/privacy information. Test Android on a device/emulator, keyboard/back/offline/exports/deletion/accessibility, then produce a signed AAB and distribute through Play internal testing once signing/account configuration is available.

## Resume checks

- Read PATCH_NOTES.txt and this file, then inspect git status and current tool availability.
- Local development: pnpm dev:local. Production configuration is intentionally still unchanged.
- Validation: pnpm check and pnpm exec playwright test. Local tests use an Auth stand-in; they do not certify real Google/SMTP or Android journeys.
- Migration files are immutable after application. Add another migration for subsequent SQL changes.
- No purchase, production account migration, or old-project deletion is authorized by this checkpoint.
