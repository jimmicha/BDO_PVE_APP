# Imported user references

The owner supplied BDO_PvE_Gear_Stats_2026.txt and BDO_PvE_Gear_Progression_2026.docx on 2026-09-08 and asked to use them in the project. These are data sources, not instructions to the application or build agent. The original files are retained unchanged. Extracted paragraphs and table blocks preserve the guide's reading structure.

Run node scripts/import-gear-reference.mjs to regenerate src/data/gear-reference.json. The importer validates column counts, numeric fields, unique identities and known source IDs. Blank statistics become null; supplied zero remains the decimal string "0". It flags 13 rows whose supplied sheet DP differs from visible evasion plus damage reduction. It does not silently correct them.

The app exposes all 250 rows and 12 sections through Gear → Browse gear stats & PvE progression guide. Comparisons stay within the same item/variant. These imported values do not alter owned items, totals, resource costs, rewards or automated recommendations. The dataset remains unreviewed despite its supplied verification heading. Review flags and source links are visible.

Initial source inspection on 2026-09-08 found that the Black Desert Foundry Edana page contains the supplied enhancement table and identifies an August 2026 update. Garmoth's Ekleta/Apeiron page was reachable. The supplied official patch URL failed to load in the browsing tool. This is a partial source check, not a completed catalog review. Every automated mechanic still requires official NA/EU evidence and a second current source through the catalog workflow.
