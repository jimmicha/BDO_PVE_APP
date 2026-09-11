import {it,expect} from 'vitest';
import data from '../src/data/grind-reference.json';
it('preserves unknown grind-zone and cost figures separately from zero',()=>{
  expect(data.zones).toHaveLength(40);expect(data.brackets).toHaveLength(165);expect(data.costs).toHaveLength(57);
  expect(data.review_status).toBe('unreviewed');
  const blankDpZone=data.zones.find(z=>z.zone==='Yzrahid Highlands')!;
  expect(blankDpZone.recommended_total_dp).toBeNull();expect(blankDpZone.recommended_total_ap).toBe('1100');
  const apeiron=data.costs.find(c=>c.item_group==='Apeiron Accessories'&&c.to_level==='PRI (I)')!;
  expect(apeiron.expected_one_level_cost_silver).toBeNull();expect(apeiron.market_upgrade_anchor_silver).toBe('30000000000');
  const kabua=data.costs.find(c=>c.item_group==="Kabua's Artifact"&&c.to_level==='BASE')!;
  expect(kabua.market_upgrade_anchor_silver).toBe('9350000000');
  expect(new Set(data.costs.map(c=>c.id)).size).toBe(57);
  for(const row of [...data.zones,...data.costs])if(row.source_id&&!row.source_id.includes('+'))expect(data.sources,'missing source '+row.source_id).toHaveProperty(row.source_id);
  const apBracket=data.brackets.find(b=>b.record_type==='AP_BRACKET'&&b.min_sheet==='100')!;
  expect(apBracket.bonus_value).toBe('5');
  const scaling=data.brackets.filter(b=>b.record_type==='MONSTER_AP_SCALING');
  expect(scaling).toHaveLength(2);expect(scaling[0].formula).toBe('8*(sheet_ap-309)');
});
