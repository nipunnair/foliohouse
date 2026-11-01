import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import YAML from 'yaml';
import {loadSite} from './sites.mjs';
import {importImage} from './folio.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function atomic(file,value){const temp=file+'.'+randomUUID();await fs.writeFile(temp,YAML.stringify(value),{mode:0o600});await fs.rename(temp,file);}
export async function readDraft(root,siteId,id){
 const site=await loadSite(root,siteId);
 if(!/^[a-f0-9]{64}$/.test(id||''))throw new Error('Provide the full submission ID.');
 const directory=path.join(root,'.private/queue',siteId,id);
 const file=path.join(directory,'submission.yaml');
 const record=YAML.parse(await fs.readFile(file,'utf8'));
 if(record.id!==id||record.site!==siteId)throw new Error('Submission identity mismatch');
 for(const image of record.images){
  if(!/^image-\d+\.(jpeg|png|webp)$/.test(image.filename)||!/^preview-\d+\.webp$/.test(image.preview))throw new Error('Unsafe media path');
  if(digest(await fs.readFile(path.join(directory,image.filename)))!==image.hash)throw new Error('Original attachment changed; review refused');
 }
 return {site,directory,file,record};
}
export function reviewHash(record){return digest(JSON.stringify({title:record.title,collection:record.collection,description:record.description,alt:record.alt,featured:record.featured,images:record.images}));}
export function validateApproval(record,site){
 if(record.images.length!==1)throw new Error('This release supports publishing one image per submission. Split multi-image submissions first.');
 if(!record.title?.trim()||record.title.length>200||/^foliohouse test/i.test(record.title))throw new Error('Choose a final artwork title, not the test subject.');
 if(!record.alt?.trim()||record.alt.length>1000||/describe the attached image|replace this sentence/i.test(record.alt))throw new Error('Supply actual descriptive alt text, not placeholder instructions.');
 if(typeof record.description!=='string'||record.description.length>10000)throw new Error('Description must be text, at most 10000 characters.');
 if(!site.collections.includes(record.collection))throw new Error('Collection is not configured for this site.');
 if(typeof record.featured!=='boolean')throw new Error('Featured must be true or false.');
}
export async function editDraft(root,siteId,id,changes){
 const {file,record,site}=await readDraft(root,siteId,id);
 if(['publishing','published'].includes(record.state))throw new Error('Cannot edit a publishing/published submission.');
 for(const [key,value] of Object.entries(changes)){
  if(!['title','alt','description','collection','featured'].includes(key))throw new Error('Unsupported edit');
  record[key]=value;
 }
 if(!site.collections.includes(record.collection))throw new Error('Unknown collection');
 record.state='needs-review';delete record.approval;
 await atomic(file,record);return record;
}
export async function approveDraft(root,siteId,id){
 const {file,record,site}=await readDraft(root,siteId,id);
 if(['publishing','published'].includes(record.state))throw new Error('Already publishing/published');
 validateApproval(record,site);
 record.approval={hash:reviewHash(record),at:new Date().toISOString(),method:'explicit-local-command'};
 record.state='approved';await atomic(file,record);return record;
}
export async function previewDraft(root,siteId,id){
 const {directory,record}=await readDraft(root,siteId,id);
 const images=await Promise.all(record.images.map(async image=>`<img alt="${escape(record.alt)}" src="data:image/webp;base64,${(await fs.readFile(path.join(directory,image.preview))).toString('base64')}"/>`));
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Private review — ${escape(record.title)}</title><style>body{background:#f7f6f1;color:#263e34;font:16px/1.7 system-ui;max-width:980px;margin:40px auto;padding:24px}h1{font:48px Georgia}img{max-width:100%;max-height:65vh;display:block;margin:30px auto}dt{font-weight:700}dd{margin:0 0 16px;white-space:pre-wrap}.notice{padding:18px;background:#e5e8d7}code{overflow-wrap:anywhere}</style><div class="notice">PRIVATE LOCAL REVIEW · ${escape(record.state)} · Nothing publishes from this page.</div><h1>${escape(record.title)}</h1>${images.join('')}<dl><dt>Collection</dt><dd>${escape(record.collection)}</dd><dt>Description</dt><dd>${escape(record.description)}</dd><dt>Alt text</dt><dd>${escape(record.alt)}</dd><dt>Featured</dt><dd>${record.featured?'Yes':'No'}</dd><dt>Submission</dt><dd><code>${escape(id)}</code></dd></dl><p>Review title, attribution, description, alt text, and permission to publish. Approval is an explicit local command, never an email instruction.</p></html>`;
 const output=path.join(directory,'review.html');await fs.writeFile(output,html,{mode:0o600});return output;
}

export async function publishDraft(root,siteId,id,{dryRun=false,deploy}={}){
 const {site,file,record,directory}=await readDraft(root,siteId,id);
 if(record.state==='published')return {status:'already-published',workId:record.workId};
 if(record.state!=='approved'||record.approval?.hash!==reviewHash(record))throw new Error('Explicit approval of the current metadata is required.');
 validateApproval(record,site);
 // Only the existing live site has a deployment target. Never guess another site's destination.
 if(!site.publishLocal||site.contentRoot!==root)throw new Error('No verified production deployment target for this site.');
 const input={root,file:path.join(directory,record.images[0].filename),title:record.title,alt:record.alt,collection:record.collection,description:record.description,featured:record.featured,publish:false};
 const validation=await importImage({...input,dryRun:true});
 if(validation.status==='duplicate')throw new Error('This image is already in the portfolio; use an explicit existing-work update instead.');
 if(dryRun)return {status:'dry-run',workId:validation.work.id,site:siteId};
 const imported=await importImage(input);
 const workFile=path.join(root,'content/works',`${imported.id}.yaml`);
 const draft=await fs.readFile(workFile,'utf8');
 const work=YAML.parse(draft);
 record.state='publishing';record.workId=imported.id;await atomic(file,record);
 try{
  work.published=true;await atomic(workFile,work);
  const result=await deploy({workId:imported.id,submissionId:id});
  record.state='published';record.publishedAt=new Date().toISOString();record.release=result.release;
  await atomic(file,record);
  return {status:'published',workId:imported.id,release:result.release};
 }catch(error){
  // Preserve a recoverable draft. An operator must reconcile before retrying if activation may have succeeded.
  await fs.writeFile(workFile,draft,{mode:0o600});
  record.state='needs-reconciliation';record.failure='Publish interrupted or failed. Inspect live release and retained draft before retrying.';
  await atomic(file,record);throw error;
 }
}

async function deploy(root,{workId,submissionId},siteId){
 const site=await loadSite(root,siteId);
 if(!site.url||!/^https?:\/\//.test(site.url))throw new Error('Configure the publishing site URL first');
 for(const task of ['test','build']){const result=spawnSync('npm',['run',task],{cwd:root,stdio:'inherit',env:{...process.env,FOLIO_SITE:site.url,FOLIO_BASE:'/'}});if(result.status!==0)throw new Error(`${task} failed; release not switched`);}
 await fs.access(path.join(root,'dist/work',workId,'index.html'));
 for(const name of ['.private','content','node_modules']){try{await fs.access(path.join(root,'dist',name));throw new Error('Private files in build');}catch(e){if(e.code!=='ENOENT')throw e;}}
 const hosting=path.join(root,'.hosting');const release=`releases/${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`;
 await fs.cp(path.join(root,'dist'),path.join(hosting,release),{recursive:true});
 // Private journal is outside the served release, for interrupted-publish reconciliation.
 await atomic(path.join(hosting,'last-review-publish.yaml'),{submissionId,workId,release});
 let old;try{old=await fs.readlink(path.join(hosting,'current'));}catch(e){if(e.code!=='ENOENT')throw e;}
 async function point(name,target){const temp=path.join(hosting,`${name}-${randomUUID()}`);await fs.symlink(target,temp);await fs.rename(temp,path.join(hosting,name));}
 if(old)await point('previous',old);
 await point('current',release);return {release};
}
async function main(){
 const {positionals,values}=parseArgs({allowPositionals:true,options:{site:{type:'string'},title:{type:'string'},alt:{type:'string'},description:{type:'string'},collection:{type:'string'},featured:{type:'string'},'dry-run':{type:'boolean'},confirm:{type:'boolean'}}});
 const [command,id]=positionals;const root=process.cwd();
 if(command==='preview'){console.log(await previewDraft(root,values.site,id));return;}
 if(!['edit','approve','publish'].includes(command))throw new Error('Commands: preview, edit, approve --confirm, publish --confirm (or --dry-run); provide full submission ID and --site.');
 if(['approve','publish'].includes(command)&&!values.confirm&&!values['dry-run'])throw new Error('--confirm is required');
 await fs.mkdir(path.join(root,'.hosting'),{recursive:true});
 const deployLock=await fs.open(path.join(root,'.hosting/deploy.lock'),'wx');
 let importLock;
 try{
  importLock=await fs.open(path.join(root,'.private/import.lock'),'wx');
  if(command==='edit'){
   const changes={};for(const key of ['title','alt','description','collection'])if(values[key]!==undefined)changes[key]=values[key];
   if(values.featured!==undefined){if(!['yes','no'].includes(values.featured))throw new Error('Featured must be yes or no');changes.featured=values.featured==='yes';}
   if(values['dry-run']){console.log({status:'dry-run',changes});return;}
   console.log((await editDraft(root,values.site,id,changes)).state);
  }else if(command==='approve'){
   if(values['dry-run']){const {record,site}=await readDraft(root,values.site,id);validateApproval(record,site);console.log('Approval validation passed; nothing changed');return;}
   console.log((await approveDraft(root,values.site,id)).state);
  }else console.log(await publishDraft(root,values.site,id,{dryRun:values['dry-run'],deploy:args=>deploy(root,args,values.site)}));
 }finally{
  if(importLock){await importLock.close();await fs.unlink(path.join(root,'.private/import.lock'));}
  await deployLock.close();await fs.unlink(path.join(root,'.hosting/deploy.lock'));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
