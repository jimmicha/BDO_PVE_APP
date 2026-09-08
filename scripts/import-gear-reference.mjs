import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const raw=await readFile('data/reference/BDO_PvE_Gear_Stats_2026.txt','utf8');
const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/),sources={};
for(const line of lines){const m=line.match(/^#\s*(\w+)\s*=\s*(https:\/\/\S+)/);if(m)sources[m[1]]=m[2];}
const records=lines.map((line,i)=>({line,index:i+1})).filter(x=>x.line.trim()&&!x.line.startsWith('#'));
const columns=records.shift().line.split('|'),seen=new Set(),issues=[];
const rows=records.map(({line,index})=>{
  const cells=line.split('|');if(cells.length!==columns.length)throw Error('Line '+index+': expected '+columns.length+' fields, got '+cells.length);
  const row=Object.fromEntries(columns.map((key,i)=>[key,cells[i]===''?null:cells[i]]));
  const id=[row.category,row.slot,row.item,row.variant,row.enhancement].join(':');if(seen.has(id))throw Error('Duplicate '+id);seen.add(id);
  for(const key of columns.slice(5,23))if(row[key]!==null&&!/^\d+(\.\d+)?$/.test(row[key]))throw Error('Invalid number at '+index+': '+key);
  if(!sources[row.source_id])throw Error('Unknown source at '+index);
  if(row.sheet_dp!==null&&row.evasion!==null&&row.damage_reduction!==null&&Number(row.sheet_dp)!==Number(row.evasion)+Number(row.damage_reduction))issues.push({id,line:index,reason:'Displayed DP differs from the supplied visible evasion + damage reduction. Confirm source values before calculations.'});
  return {id,source_line:index,...row};
});
const blocks=JSON.parse(await readFile('data/reference/progression-blocks.json','utf8'));
const headings=JSON.parse(await readFile('data/reference/progression-paragraphs.json','utf8')).filter(p=>/^\d+\. [A-Z]/.test(p));
const sections=[];for(const block of blocks){const text=block.type==='paragraph'?block.text:block.rows?.length===1&&block.rows[0].length===1?block.rows[0][0]:'';const heading=headings.find(h=>text?.startsWith(h));if(heading){sections.push({title:heading,blocks:[]});const subtitle=text.slice(heading.length).trim();if(subtitle)sections.at(-1).blocks.push({type:'paragraph',text:subtitle});}else if(sections.length)sections.at(-1).blocks.push(block);}
if(sections.length!==12)throw Error('Expected 12 guide sections; found '+sections.length);
const result={version:'user-reference-2026-09-08',region:'PC NA/EU',imported_at:'2026-09-08',review_status:'unreviewed',source_sha256:createHash('sha256').update(raw).digest('hex'),sources,columns,issues,rows,sections};
await writeFile('src/data/gear-reference.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({rows:rows.length,sections:sections.length,issues:issues.length}));
