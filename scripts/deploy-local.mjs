import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const root=process.cwd();
const hosting=path.join(root,'.hosting');
const args=process.argv.slice(2);
if(args.some(a=>!['--dry-run','--rollback'].includes(a)))throw new Error('Supported options: --dry-run, --rollback');
if(args.includes('--dry-run')){console.log({action:args.includes('--rollback')?'rollback':'test, build and deploy',hosting,site:process.env.FOLIO_SITE||'http://localhost:4381'});process.exit(0);}
await fs.mkdir(hosting,{recursive:true});
const lock=await fs.open(path.join(hosting,'deploy.lock'),'wx');
const current=path.join(hosting,'current');
const previous=path.join(hosting,'previous');
async function target(file){try{return await fs.readlink(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function point(file,value){const temporary=`${file}.${randomUUID()}`;await fs.symlink(value,temporary);await fs.rename(temporary,file);}
try{
 const old=await target(current);
 if(args.includes('--rollback')){
  const prior=await target(previous);if(!prior)throw new Error('No previous release exists.');
  await fs.access(path.join(hosting,prior,'index.html'));await point(current,prior);if(old)await point(previous,old);
  console.log('Rolled back to',prior);
 }else{
  for(const task of ['test','build']){
   const result=spawnSync('npm',['run',task],{stdio:'inherit',env:{...process.env,FOLIO_SITE:process.env.FOLIO_SITE||'http://localhost:4381',FOLIO_BASE:'/'}});
   if(result.status!==0)throw new Error(`${task} failed; live release unchanged`);
  }
  const id=`releases/${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`;
  const release=path.join(hosting,id);
  await fs.cp(path.join(root,'dist'),release,{recursive:true,errorOnExist:true,force:false});
  await fs.access(path.join(release,'index.html'));
  for(const forbidden of ['.private','content','node_modules']){try{await fs.access(path.join(release,forbidden));throw new Error(`Unsafe build output: ${forbidden}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
  if(old)await point(previous,old);
  await point(current,id);
  console.log('Live release:',id);
 }
}finally{await lock.close();await fs.unlink(path.join(hosting,'deploy.lock'));}
