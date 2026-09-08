// Build first. Produces a static Vercel connector payload, without any server credentials.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const files=[];
async function collect(dir,prefix=''){
  for(const item of await readdir(dir,{withFileTypes:true})){
    const file=prefix+item.name,path=join(dir,item.name);
    if(item.isDirectory())await collect(path,file+'/');
    else {const binary=/\.(png|jpg|jpeg|woff2?|ico)$/i.test(file);files.push({file,data:await readFile(path,binary?'base64':'utf8'),encoding:binary?'base64':'utf-8'});}
  }
}
await collect('dist');
const config=JSON.parse(await readFile('vercel.json','utf8'));
for(const key of ['framework','buildCommand','installCommand','outputDirectory'])delete config[key];
files.push({file:'vercel.json',data:JSON.stringify(config),encoding:'utf-8'});
await mkdir('.local',{recursive:true});
await writeFile('.local/deployment-payload.json',JSON.stringify({name:'bdo-companion',target:'preview',files}));
console.log('Static deployment payload prepared: '+files.length+' files.');
