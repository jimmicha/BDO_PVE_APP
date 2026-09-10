# Completion review — 2026-09-10

The app is a working core implementation, but the invited beta is not complete.

## New planning changes

The supplied ZIP contains one JSON draft, catalog-v2-ladder.json: 70 milestones and 23 item types. The original is retained unchanged in data/reference. Run node scripts/import-ladder.mjs to rebuild the normalized draft. Administrators can copy the current catalog to a draft, open Edit draft, load the supplied ladder, inspect review notes and save it without inventing verification dates.

The normalized draft preserves all seven version-one template keys and six family claim keys. It retains the reviewed Olvia prerequisite rather than adding an unverified season-graduation requirement. Publication remains blocked until review dates and evidence are supplied; ordinary players cannot receive this draft as an automated recommendation.

## Catalog issues before publication

- No current review dates are provided. Most new costs and conversion rules are unverified; empty requirements must not be treated as proof of a free upgrade.
- The current completion engine creates reward equipment. Upgrade/conversion steps need a reviewed transaction model that consumes or updates the selected existing item instead of adding another item. The new ladder must remain a draft until those semantics are resolved.
- A set reward currently produces one inventory record. A complete Tuvala set needs explicit per-slot items if it is to become equipment automatically.
- Later ring/earring stages and whole-set milestones require review for both slots and all pieces. Class-specific weapon priorities should not become unconditional prerequisites.
- Theoretical endgame targets, stat claims and new systems require current official PC NA/EU evidence and a second reference. The ZIP's draft status is preserved.

## Release gaps

- New Supabase project taxhvwhachtrhtcdbnsz: core migration was successfully applied after reconnection. Remaining four migrations, catalog seed, administrator invitation and delete-account function are not yet confirmed installed. Supabase tools became unavailable in this session after that first migration. Do not deploy a frontend cutover until hosted isolation and transaction tests pass on the new project.
- Google OAuth, SMTP, signup hook and real verification/recovery/linking journeys still need configuration and verification. Web/native return URLs have been saved.
- Android debug APK now exists with application ID com.jimmicha.bdocompanion, version 0.1.0, minimum SDK 24. Compilation is not a device test or a signed Play release. The build still embeds the previous backend configuration.
- Separate staging, active daily encrypted backups, alerts and a real hosted restore rehearsal are outstanding. Local recovery tests pass; workflow files alone do not establish operating backups.
- Final operator/privacy information and manual assistive-technology testing remain outstanding.

Earlier hosted checks passed against the previous backend only. Do not describe the replacement backend or invited beta as complete based on those results.

## Verification for this change

All 15 core tests and the production build passed. The administrator import/save journey passed in both desktop and mobile browser configurations. These checks do not certify the imported game mechanics or replace hosted and Android device acceptance tests.
