-- The Kharazad accessory steps were tagged category:'accessory' by hand in
-- supabase/seed.sql (20260914130000), but seed.sql is an insert with
-- `on conflict(id) do nothing`: any environment where this fixed-id catalog
-- row was already installed keeps its pre-category content forever, and any
-- goal already migrated onto it keeps category=null on its accessory steps
-- (Roadmap.tsx files them under "General" instead of "Accessory
-- progression"). Patch both the catalog content and the goal steps already
-- created from it directly, as a forward correction rather than relying on
-- a reseed. Both statements are idempotent: once a step already carries
-- category:'accessory' they no longer match and re-running is a no-op.
update app_private.catalog_versions c
set content = jsonb_set(c.content,'{steps}',
  (select jsonb_agg(
     case when e->>'key' in ('necklace','belt','ring_1','ring_2','earring_1','earring_2')
       then e || jsonb_build_object('category','accessory') else e end
     order by ord)
   from jsonb_array_elements(c.content->'steps') with ordinality as t(e,ord)))
where c.id = 'ab100000-0000-4000-8000-000000000001'
  and exists(
    select 1 from jsonb_array_elements(c.content->'steps') e
    where e->>'key' in ('necklace','belt','ring_1','ring_2','earring_1','earring_2')
      and e->>'category' is distinct from 'accessory'
  );

update app_private.goal_steps gs
set category = 'accessory'
from app_private.goals g
where gs.goal_id = g.id
  and g.catalog_version_id = 'ab100000-0000-4000-8000-000000000001'
  and gs.template_key in ('necklace','belt','ring_1','ring_2','earring_1','earring_2')
  and gs.category is null;
