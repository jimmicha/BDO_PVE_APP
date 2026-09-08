import {writeFile} from 'node:fs/promises';
import {catalog} from './catalog.mjs';
const q=(s)=>"'"+String(s).replaceAll("'","''")+"'";
const keys=Object.keys(catalog);
const values=keys.map(k=>typeof catalog[k]==='object'?q(JSON.stringify(catalog[k]))+'::jsonb':q(catalog[k]));
await writeFile(new URL('../supabase/seed.sql',import.meta.url),'-- Generated from scripts/catalog.mjs. No private player data or production invitations.\ninsert into app_private.catalog_versions ('+keys.join(',')+') values ('+values.join(',')+') on conflict(id) do nothing;\n');
