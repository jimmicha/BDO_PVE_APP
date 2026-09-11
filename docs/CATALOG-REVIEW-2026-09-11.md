# Ladder review checkpoint — PC NA/EU

The 70-step ladder remains a draft. This is a partial source review and a complete structural triage, not certification of every statistic, recipe or recommendation. Unknown requirements do not mean zero cost. No catalog has been published by this review.

## Evidence checked

| Scope | Evidence | Result |
| --- | --- | --- |
| Six Kharazad support claims | [Official FAQ 655](https://support.pearlabyss.com/blackdesert_naeu/en-US/Faq/Home/Detail?_faqNo=655), updated August 11, 2026; [Garmoth HYPERBOOST](https://garmoth.com/guides/post/hyperboost-update) | Confirms the existing six once-per-family rewards and 10 Essence of Dawn / 50 Sharp Black Crystal Shards for each. Enrollment availability is not certified. |
| Garmoth reform | [Official Garmoth's Heart guide](https://www.naeu.playblackdesert.com/en-US/Wiki?wikiNo=453), edited May 14, 2026, read in Chrome | Awakening effect is two crystal slots and 3% critical-hit damage. The draft's awakening +3 displayed AP claim is wrong against this source. Main-hand Sovereign reform lists +3 displayed AP; the draft's extra +50 accuracy is not supported as a reform effect by this table. |
| Ekleta / Apeiron release and conversion | [Official release history](https://www.naeu.playblackdesert.com/en-US/Adventure/History?_groupMasterNo=10557&year=2026), August 13, 2026; [Garmoth accessory guide](https://garmoth.com/guides/post/ekleta-apeiron-accessories) | Confirms released PC content, NOV Kharazad to base Ekleta and DEC to TET, preservation of reform state, differing market/enhancement rules and a same-slot enhancement input. Exchange prerequisites still need explicit catalog representation. |
| Latest patch | [September 10, 2026 official notes](https://www.naeu.playblackdesert.com/en-US/News/Detail?groupContentNo=10577), read in Chrome | Confirms current Inner Edania and Apeiron reward content. Weekly rewards now include choice boxes. This is not evidence for all numerical ladder stats. The page heading is September 10; its introductory sentence says July 30, an internal source inconsistency. |
| Edana release source located | [Official Edana Defense Gear history](https://www.naeu.playblackdesert.com/en-US/Adventure/History?_groupMasterNo=9097&year=2025) | Correct PC source located; detailed tables not yet fully reconciled. Do not substitute Console or Global Lab notes for PC NA/EU evidence. |

## Publication blockers found in the data

- Set rewards use a single equipment reward. The Tuvala row cannot yield thirteen independent pieces; the Slumbering Origin and multi-weapon/multi-artifact goals also need explicit item-level representation.
- Upgrade and conversion rewards omit `reward.source`. They would create another item rather than update/consume the selected source item, despite the backend now supporting guided conversions.
- Later ring and earring stages have one row per accessory type, so progression of both slots is not represented.
- The primary Sovereign PEN goal describes class/spec choice but hardcodes a main-hand reward. Shai and other class-specific exceptions require review.
- Stochastic enhancement goals cannot use a fabricated fixed total cost. Separate per-attempt recipes, observed spending, probabilities and target milestones.
- Stage dependencies and inherited claim identities must be reviewed together. The importer preserves all six existing claim keys and seven template identities; it removes the unverified season prerequisite from Olvia.
- Horizon targets and general advice must not silently award equipment or claim a universal best-value order.

## Coverage and next review

The row ledger `data/reference/ladder-review-2026-09-11.json` lists every source row and outstanding checks. The six inherited support rewards are the only rows with reviewed fixed material deductions. Other rows require numerical and/or transaction review even where the underlying mechanic has supporting evidence. Keep top-level `checked_at` and `valid_until` unset until the full publication review passes.

Next: reconcile official Edana, Sovereign, artifacts/lightstones and Kharazad tables; verify the season/support routes and class exceptions; model sets and both accessory slots; then preview migration of existing goals before publishing.
