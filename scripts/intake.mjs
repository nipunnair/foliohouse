import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {simpleParser} from 'mailparser';
import {convert} from 'html-to-text';
import sharp from 'sharp';
import YAML from 'yaml';
import {loadSite} from './sites.mjs';

export async function parseSubmission(raw,site){
 if(raw.length>30*1024*1024)throw new Error('Email exceeds 30 MB');
 const mail=await simpleParser(raw,{skipHtmlToText:false,skipTextToHtml:true,skipImageLinks:true,maxHtmlLengthToParse:100_000});
 const senders=mail.from?.value||[];
 if(senders.length!==1||!site.allowedSenders.includes(senders[0].address?.toLowerCase()))throw new Error('Sender is not allowlisted');
 const recipients=[mail.to,mail.cc].flat().filter(Boolean).flatMap(v=>v.value||[]).map(v=>v.address?.toLowerCase());
 if(!site.inbox||!recipients.includes(site.inbox.toLowerCase()))throw new Error('Recipient does not match this site');
 if(!mail.text?.trim()&&typeof mail.html==='string'&&mail.html.length<=100_000){
  mail.text=convert(mail.html,{wordwrap:false,limits:{maxDepth:100},selectors:[{selector:'img',format:'skip'},{selector:'a',options:{ignoreHref:true}}]});
 }
 if(!mail.text?.trim())throw new Error('A readable plain-text or HTML message body is required');
 const fields={};const prose=[];let body=false;
 for(const line of mail.text.replace(/\r\n/g,'\n').trim().split('\n')){
  if(!body&&!line.trim())continue;
  const match=!body&&line.match(/^(Collection|Alt|Featured|Action):\s*(.*)$/i);
  if(match){const key=match[1].toLowerCase();if(key in fields)throw new Error(`Repeated field: ${key}`);fields[key]=match[2].trim();}
  else{body=true;prose.push(line);}
 }
 if(!site.collections.includes(fields.collection))throw new Error(`Collection must be one of: ${site.collections.join(', ')}`);
 if(fields.action&&!['draft','publish'].includes(fields.action.toLowerCase()))throw new Error('Action must be draft or publish');
 if(fields.featured&&!['yes','no'].includes(fields.featured.toLowerCase()))throw new Error('Featured must be yes or no');
 const title=mail.subject?.trim();if(!title||title.length>200)throw new Error('Subject must contain a title of at most 200 characters');
 if(prose.join('\n').length>10000)throw new Error('Description exceeds 10000 characters');
 const attachments=mail.attachments.filter(a=>a.contentDisposition!=='inline');
 if(attachments.length<1||attachments.length>10)throw new Error(`Attach 1–10 images as file attachments. Found ${attachments.length} regular attachments and ${mail.attachments.length-attachments.length} inline parts (ignored to avoid importing signatures).`);
 const images=[];
 for(const [index,a] of attachments.entries()){
  if(a.size>25*1024*1024)throw new Error('Image exceeds 25 MB');
  const input=sharp(a.content,{limitInputPixels:40_000_000});const meta=await input.metadata();
  if(!['jpeg','png','webp'].includes(meta.format)||(meta.pages||1)>1)throw new Error('Only still JPEG, PNG and WebP attachments are accepted');
  const preview=await input.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  images.push({filename:`image-${index+1}.${meta.format}`,bytes:a.content,preview,hash:createHash('sha256').update(a.content).digest('hex')});
 }
 return {title,collection:fields.collection,description:prose.join('\n').trim(),alt:fields.alt||'',featured:fields.featured?.toLowerCase()==='yes',requestedAction:fields.action?.toLowerCase()||'draft',sender:senders[0].address.toLowerCase(),images};
}

export async function ingestEmail({root,siteId,raw,dryRun=false}){
 const site=await loadSite(root,siteId);
 const submission=await parseSubmission(raw,site);
 // Deduplicate normalized content, not untrusted Message-ID headers.
 const {images,...metadata}=submission;
 const id=createHash('sha256').update(JSON.stringify({siteId,...metadata,images:images.map(i=>i.hash)})).digest('hex');
 const record={id,site:siteId,state:'needs-review',senderAuthentication:'unverified',...metadata,images:images.map(({filename,hash},index)=>({filename,hash,preview:`preview-${index+1}.webp`})),warnings:['Sender allowlisting is not authentication. Local review is required before any publishing.',...(!submission.alt?['Alt text is missing; provide it before importing.']:[]),...(submission.requestedAction==='publish'?['Publish request held: this adapter is draft-only.']:[])]};
 if(dryRun)return {status:'dry-run',record};
 const queue=path.join(root,'.private/queue',siteId);await fs.mkdir(queue,{recursive:true,mode:0o700});
 const destination=path.join(queue,id);
 try{await fs.access(destination);return {status:'duplicate',id};}catch(e){if(e.code!=='ENOENT')throw e;}
 const staging=path.join(queue,`.pending-${randomUUID()}`);await fs.mkdir(staging,{mode:0o700});
 try{
  for(const [index,img] of images.entries()){
   await fs.writeFile(path.join(staging,img.filename),img.bytes,{mode:0o600});
   await fs.writeFile(path.join(staging,`preview-${index+1}.webp`),img.preview,{mode:0o600});
  }
  await fs.writeFile(path.join(staging,'submission.yaml'),YAML.stringify(record),{mode:0o600});
  try{await fs.rename(staging,destination);}catch(e){if(['EEXIST','ENOTEMPTY'].includes(e.code)){await fs.rm(staging,{recursive:true});return {status:'duplicate',id};}throw e;}
  return {status:'queued',id,state:record.state,images:images.length};
 }catch(e){await fs.rm(staging,{recursive:true,force:true});throw e;}
}

async function main(){
 const {values,positionals}=parseArgs({allowPositionals:true,options:{site:{type:'string'},'dry-run':{type:'boolean'}}});
 const root=process.cwd();const [command,file]=positionals;
 const site=await loadSite(root,values.site);
 if(command==='list'){
  const queue=path.join(root,'.private/queue',site.id);const entries=await fs.readdir(queue).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  for(const id of entries.filter(s=>/^[a-f0-9]{64}$/.test(s))){const item=YAML.parse(await fs.readFile(path.join(queue,id,'submission.yaml'),'utf8'));console.log(JSON.stringify({id,title:item.title,state:item.state,images:item.images.length}));}return;
 }
 if(command!=='email'||!file)throw new Error('Usage: node scripts/intake.mjs email MESSAGE.eml --site demo [--dry-run] OR list --site demo');
 if((await fs.stat(file)).size>30*1024*1024)throw new Error('Email exceeds 30 MB');
 console.log(JSON.stringify(await ingestEmail({root,siteId:site.id,raw:await fs.readFile(file),dryRun:values['dry-run']}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
