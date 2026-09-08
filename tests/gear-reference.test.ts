import {it,expect} from 'vitest';
import data from '../src/data/gear-reference.json';
it('preserves unknown statistics separately from zero and flags inconsistent DP',()=>{
  expect(data.rows).toHaveLength(250);expect(data.sections).toHaveLength(12);
  const base=data.rows.find(r=>r.item==='Apeiron Necklace'&&r.enhancement==='+0')!;
  expect(base.sheet_dp).toBe('0');expect(base.monster_ap).toBeNull();
  expect(data.review_status).toBe('unreviewed');expect(data.issues).toHaveLength(13);
  expect(new Set(data.rows.map(r=>r.id)).size).toBe(250);
  for(const row of data.rows)expect(data.sources).toHaveProperty(row.source_id);
});
