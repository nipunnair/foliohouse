// Build from an explicit public allowlist, never from the host's personal portfolio.
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';
import {importImage,stageMedia} from './folio.mjs';
const root=process.cwd();
if(process.argv.slice(2).some(a=>a!=='--dry-run'))throw new Error('Only --dry-run is supported');
const selected=YAML.parse(await fs.readFile(path.join(root,'examples/showcase/works.yaml'),'utf8'));
if(process.argv.includes('--dry-run')){console.log({source:'examples/showcase',works:selected.length,output:'demo-dist',personalContent:false});process.exit(0);}
const base=path.join(root,'.private/demo-builds');
await fs.mkdir(base,{recursive:true});
const workspace=await fs.mkdtemp(path.join(base,'public-'));
try{
 for(const name of ['src','astro.config.mjs','package.json'])await fs.cp(path.join(root,name),path.join(workspace,name),{recursive:true});
 await fs.mkdir(path.join(workspace,'content'),{recursive:true});
 await fs.mkdir(path.join(workspace,'public'),{recursive:true});
 await fs.copyFile(path.join(root,'examples/showcase/site.yaml'),path.join(workspace,'content/site.yaml'));
 await fs.copyFile(path.join(root,'public/favicon.svg'),path.join(workspace,'public/favicon.svg'));
 for(const item of selected){
  if(!Number.isSafeInteger(item.museumId))throw new Error('Invalid museum ID');
  const result=await importImage({root:workspace,file:path.join(root,'examples/showcase/assets',item.museumId+'.jpg'),title:item.title,alt:item.alt,collection:item.collection,featured:!!item.featured,publish:true,description:item.artist+(item.date?' · '+item.date:'')+'. Public-domain work from the Art Institute of Chicago. This display title and visual description are editorial demo text, not an artist statement.'});
  const file=path.join(workspace,'content/works',result.id+'.yaml');
  const work=YAML.parse(await fs.readFile(file,'utf8'));
  work.credit=item.artist;work.sourceUrl='https://www.artic.edu/artworks/'+item.museumId;
  await fs.writeFile(file,YAML.stringify(work));
 }
 await stageMedia(workspace);
 const result=spawnSync(process.execPath,[path.join(root,'node_modules/astro/bin/astro.mjs'),'build'],{cwd:workspace,stdio:'inherit',env:{...process.env,FOLIO_DEMO:'true',FOLIO_SITE:process.env.FOLIO_SITE||'https://nipunnair.github.io',FOLIO_BASE:process.env.FOLIO_BASE||'/foliohouse'}});
 if(result.status!==0)throw new Error('Demo build failed');
 // Only the known generated demo output is replaced.
 await fs.rm(path.join(root,'demo-dist'),{recursive:true,force:true});
 await fs.cp(path.join(workspace,'dist'),path.join(root,'demo-dist'),{recursive:true});
 console.log('Public demo ready: demo-dist (no personal data read)');
}finally{await fs.rm(workspace,{recursive:true,force:true});}
