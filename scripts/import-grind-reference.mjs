import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sourcesOf=lines=>{const s={};for(const line of lines){const m=line.match(/^#\s*(\w+)\s*=\s*(https:\/\/\S+)/);if(m)s[m[1]]=m[2];}return s;};
const bareUrlsOf=lines=>lines.map(l=>l.match(/^#\s*(https:\/\/\S+)/)?.[1]).filter(Boolean);
const parse=(raw,{numericCols=[],requiredNumericCols=[]}={})=>{
  const lines=raw.replace(/^﻿/,'').split(/\r?\n/);
  const sources=sourcesOf(lines);
  const records=lines.map((line,i)=>({line,index:i+1})).filter(x=>x.line.trim()&&!x.line.startsWith('#'));
  const columns=records.shift().line.split('|');
  const rows=records.map(({line,index})=>{
    const cells=line.split('|');
    if(cells.length!==columns.length)throw Error('Line '+index+': expected '+columns.length+' fields, got '+cells.length);
    const row=Object.fromEntries(columns.map((key,i)=>[key,cells[i]===''?null:cells[i]]));
    for(const key of numericCols){
      if(row[key]===null)continue;
      const normalized=row[key].replace(/,/g,'');
      if(!/^-?\d+(\.\d+)?$/.test(normalized))throw Error('Invalid number at line '+index+': '+key+'='+row[key]);
      row[key]=normalized;
    }
    for(const key of requiredNumericCols)if(row[key]===null)throw Error('Missing required value at line '+index+': '+key);
    if(row.source_id&&!sources[row.source_id]&&!row.source_id.includes('+'))throw Error('Unknown source at line '+index+': '+row.source_id);
    return {source_line:index,...row};
  });
  return {sources,columns,rows};
};

const zoneRaw=await readFile('data/reference/BDO_PvE_Zone_AP_DP_Requirements_2026.txt','utf8');
const zones=parse(zoneRaw,{numericCols:['party_size','recommended_sheet_ap','recommended_sheet_dp','recommended_total_ap','recommended_total_dp','effective_ap_cap_total'],requiredNumericCols:['party_size']});

const bracketRaw=await readFile('data/reference/BDO_AP_DP_Brackets_2026.txt','utf8');
const brackets=parse(bracketRaw,{numericCols:['min_sheet','max_sheet','bonus_value']});
for(const row of brackets.rows){
  if(row.record_type.endsWith('_BRACKET')&&row.bonus_value===null)throw Error('Bracket row missing bonus_value at line '+row.source_line);
}
const bracketSourceUrls=bareUrlsOf(bracketRaw.split(/\r?\n/));

const costRaw=await readFile('data/reference/BDO_Upgrade_Silver_Costs_2026.txt','utf8');
const costs=parse(costRaw,{numericCols:['cron_stones_per_attempt','cron_vendor_cost_per_attempt_silver','expected_one_level_cost_silver','market_upgrade_anchor_silver']});
for(const row of costs.rows){
  const id=[row.category,row.item_group,row.from_level,row.to_level].join(':');
  row.id=id;
}
const seen=new Set();for(const row of costs.rows){if(seen.has(row.id))throw Error('Duplicate cost row '+row.id);seen.add(row.id);}

const allSources={...zones.sources,...brackets.sources,...costs.sources};
const result={
  version:'user-reference-2026-09-10',
  region:'PC NA/EU',
  imported_at:'2026-09-10',
  review_status:'unreviewed',
  source_sha256:{
    zones:createHash('sha256').update(zoneRaw).digest('hex'),
    brackets:createHash('sha256').update(bracketRaw).digest('hex'),
    costs:createHash('sha256').update(costRaw).digest('hex'),
  },
  sources:allSources,
  bracket_source_urls:bracketSourceUrls,
  zone_columns:zones.columns,
  bracket_columns:brackets.columns,
  cost_columns:costs.columns,
  zones:zones.rows,
  brackets:brackets.rows,
  costs:costs.rows,
};
await writeFile('src/data/grind-reference.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({zones:zones.rows.length,brackets:brackets.rows.length,costs:costs.rows.length,sources:Object.keys(allSources).length}));
