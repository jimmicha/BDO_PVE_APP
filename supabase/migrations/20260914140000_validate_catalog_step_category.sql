-- A step's optional category was threaded through companion_command and
-- companion_migrate_goal in 20260914130000, but validate_catalog was not
-- extended for it: a typo such as category:"weapons" would pass catalog
-- review and publish, then fail every subsequent guided goal_create or
-- goal_migrate for that guide once the check-constrained goal_steps.category
-- rejects the bad value. Reject it up front, at the same place every other
-- catalog field is validated, so a malformed guide cannot reach players.
create or replace function app_private.validate_catalog(doc jsonb) returns void language plpgsql
set search_path=pg_catalog,app_private as $$
declare x jsonb; r jsonb; dep text; keys text[];
begin
  if jsonb_typeof(doc->'steps') is distinct from 'array' or jsonb_typeof(doc->'items') is distinct from 'array' or jsonb_typeof(doc->'resources') is distinct from 'array' then raise exception 'VALIDATION: Catalog requires steps, items and resources arrays.'; end if;
  if jsonb_array_length(doc->'steps') not between 1 and 100 then raise exception 'VALIDATION: Catalog must contain 1–100 steps.'; end if;
  foreach dep in array array['steps','items','resources'] loop
    if exists(select 1 from jsonb_array_elements(doc->dep) v where length(trim(coalesce(v->>'key','')))=0) or
      (select count(*) from jsonb_array_elements(doc->dep))<>(select count(distinct v->>'key') from jsonb_array_elements(doc->dep) v) then raise exception 'VALIDATION: Catalog keys must be present and unique.'; end if;
  end loop;
  keys:='{}';
  for x in select * from jsonb_array_elements(doc->'items') loop
    if length(trim(coalesce(x->>'name','')))=0 or jsonb_typeof(x->'enhancements') is distinct from 'array' or jsonb_typeof(x->'slots') is distinct from 'array' then raise exception 'VALIDATION: Invalid catalog equipment.'; end if;
    for r in select * from jsonb_array_elements(x->'enhancements') loop
      if (r#>>'{}')::integer not between 0 and 25 then raise exception 'VALIDATION: Invalid enhancement.'; end if;
    end loop;
  end loop;
  for x in select * from jsonb_array_elements(doc->'steps') loop
    if length(trim(coalesce(x->>'title','')))=0 then raise exception 'VALIDATION: Every step needs a title.'; end if;
    if x->>'category' is not null and x->>'category' not in ('weapon','armor','accessory','alchemy_stone','artifact','lifeskill','other') then raise exception 'VALIDATION: Invalid step category.'; end if;
    for dep in select * from jsonb_array_elements_text(coalesce(x->'dependencies','[]')) loop
      if not dep=any(keys) then raise exception 'DEPENDENCY_CYCLE: Catalog prerequisites must exist earlier in the step list.'; end if;
    end loop;
    keys:=array_append(keys,x->>'key');
    for r in select * from jsonb_array_elements(coalesce(x->'requirements','[]')) loop
      if app_private.quantity(r->>'quantity')<1 or not exists(select 1 from jsonb_array_elements(doc->'resources') v where v->>'key'=r->>'resource_key') then raise exception 'VALIDATION: Invalid catalog resource requirement.'; end if;
    end loop;
    if x->'reward' is not null and x->'reward'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(doc->'items') i where i->>'key'=x->'reward'->>'item_key' and i->'enhancements' @> jsonb_build_array((x->'reward'->>'enhancement')::integer)) then raise exception 'VALIDATION: Invalid reward.'; end if;
    if x->'reward' is not null and x->'reward'<>'null'::jsonb and x->'reward'->'source' is not null and x->'reward'->'source'<>'null'::jsonb then
      if not exists(select 1 from jsonb_array_elements(doc->'items') i where i->>'key'=x->'reward'->'source'->>'item_key') then
        raise exception 'VALIDATION: Conversion source item does not exist in this catalog.';
      end if;
      if coalesce((x->'reward'->'source'->>'min_enhancement')::integer,0) not between 0 and 25
        or coalesce((x->'reward'->'source'->>'max_enhancement')::integer,25) not between 0 and 25
        or coalesce((x->'reward'->'source'->>'min_enhancement')::integer,0) > coalesce((x->'reward'->'source'->>'max_enhancement')::integer,25) then
        raise exception 'VALIDATION: Invalid conversion enhancement range.';
      end if;
      if x->'reward'->'source'->>'item_key' = x->'reward'->>'item_key'
        and coalesce((x->'reward'->'source'->>'max_enhancement')::integer,25) >= (x->'reward'->>'enhancement')::integer then
        raise exception 'VALIDATION: A same-item conversion must increase enhancement beyond the source range.';
      end if;
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(doc->'steps') v where v->>'claim_key' is not null)<>(select count(distinct v->>'claim_key') from jsonb_array_elements(doc->'steps') v where v->>'claim_key' is not null) then raise exception 'VALIDATION: Claim keys must be unique.'; end if;
end $$;
revoke all on function app_private.validate_catalog(jsonb) from public,anon,authenticated;
