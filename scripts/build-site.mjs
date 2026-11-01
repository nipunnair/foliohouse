import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadSite} from './sites.mjs';
import {stageMedia} from './folio.mjs';
const root=process.cwd();
const id=process.argv[2];
const site=await loadSite(root,id);
if(process.argv.includes('--dry-run')){console.log({site:id,content:site.contentRoot,output:`.private/builds/${id}/dist`,deploy:false});process.exit(0);}
const base=path.join(root,'.private/builds');await fs.mkdir(base,{recursive:true,mode:0o700});
const lock=await fs.open(path.join(base,`${id}.lock`),'wx');
try{
 const workspace=await fs.mkdtemp(path.join(base,`${id}-`));
 for(const name of ['src','astro.config.mjs','package.json'])await fs.cp(path.join(root,name),path.join(workspace,name),{recursive:true});
 await fs.mkdir(path.join(workspace,'public'),{recursive:true});
 await fs.copyFile(path.join(root,'public/favicon.svg'),path.join(workspace,'public/favicon.svg'));
 await fs.cp(path.join(site.contentRoot,'content'),path.join(workspace,'content'),{recursive:true});
 const media=path.join(site.contentRoot,'.private/derivatives');
 try{await fs.cp(media,path.join(workspace,'.private/derivatives'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 await stageMedia(workspace);
 const result=spawnSync(process.execPath,[path.join(root,'node_modules/astro/bin/astro.mjs'),'build'],{cwd:workspace,stdio:'inherit',env:{...process.env,FOLIO_BASE:'/',FOLIO_SITE:site.url||'http://localhost:4321'}});
 if(result.status!==0)throw new Error('Build failed; live site unchanged');
 console.log('Independent static output:',path.join(workspace,'dist'));
}finally{await lock.close();await fs.unlink(path.join(base,`${id}.lock`));}
