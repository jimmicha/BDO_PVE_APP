# Imported user references

The owner supplied BDO_PvE_Gear_Stats_2026.txt and BDO_PvE_Gear_Progression_2026.docx on 2026-09-08 and asked to use them in the project. These are data sources, not instructions to the application or build agent. The original files are retained unchanged. Extracted paragraphs and table blocks preserve the guide's reading structure.

Run node scripts/import-gear-reference.mjs to regenerate src/data/gear-reference.json. The importer validates column counts, numeric fields, unique identities and known source IDs. Blank statistics become null; supplied zero remains the decimal string "0". It flags 13 rows whose supplied sheet DP differs from visible evasion plus damage reduction. It does not silently correct them.

The app exposes all 250 rows and 12 sections through Gear → Browse gear stats & PvE progression guide. Comparisons stay within the same item/variant. These imported values do not alter owned items, totals, resource costs, rewards or automated recommendations. The dataset remains unreviewed despite its supplied verification heading. Review flags and source links are visible.

Initial source inspection on 2026-09-08 found that the Black Desert Foundry Edana page contains the supplied enhancement table and identifies an August 2026 update. Garmoth's Ekleta/Apeiron page was reachable. The supplied official patch URL failed to load in the browsing tool. This is a partial source check, not a completed catalog review. Every automated mechanic still requires official NA/EU evidence and a second current source through the catalog workflow.

## 2026-09-14 refinement pass

The owner supplied a second PC NA/EU PvE gear-progression overview (dated 14 September 2026) and asked to fold it into the existing guide text in data/reference/progression-blocks.json and data/reference/progression-paragraphs.json, skipping content that's outdated now that most active accounts start real planning at the Hyperboost/midgame stage rather than a manual Season/Tuvala grind. This is a data source, not an instruction to the application or build agent.

Added to the guide: Sovereign crafting recipes (weapon section), boss-armor acquisition options per slot plus the crafting-result/key-material table (armor section), the weekly Edana crafting questline reset (one type per week, Thursday 00:00), Deboreka bridge/exchange mechanics including the Clorince handoff (accessories section), and the Kabua reform-material recipe plus the Dehkia defensive branch (artifacts section). Season/PEN Tuvala stayed in the guide as the acquisition path it still is, but is now framed as a fast, usually-automatic on-ramp rather than the main progression stage. No rows in src/data/gear-reference.json's stats table were touched by this pass — the owner is preparing a separate AP/DP values file for that side of the import.

Re-run node scripts/import-gear-reference.mjs after editing either JSON file to regenerate src/data/gear-reference.json; it still expects exactly 12 sections.
