import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import YAML from 'yaml';

export function slugify(value) {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if (!slug || slug.length > 100) throw new Error('Title must produce a slug of 1–100 characters.');
  return slug;
}

export async function importImage({ root, file, title, collection='Studies', description='', alt, featured=false, publish=false, dryRun=false }) {
  if (!title?.trim() || !alt?.trim()) throw new Error('A title and descriptive alt text are required.');
  if (title.length>200 || alt.length>1000 || description.length>10000 || !collection.trim()) throw new Error('Invalid metadata length or collection.');
  const id=slugify(title);
  const stat=await fs.stat(file);
  if(!stat.isFile() || stat.size>25*1024*1024) throw new Error('Expected an image file no larger than 25 MB.');
  const bytes=await fs.readFile(file);
  const hash=createHash('sha256').update(bytes).digest('hex');
  const metadata=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();
  if(!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages||1)>1) throw new Error('Only still JPEG, PNG, and WebP images are supported.');
  // Decode even in dry-run mode; metadata alone does not validate the pixel stream.
  const display=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().resize({width:1600,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
  const thumbnail=await sharp(bytes,{limitInputPixels:40_000_000}).rotate().resize({width:700,height:900,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
  const workDir=path.join(root,'content/works');
  const existing=await fs.readdir(workDir).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  for(const name of existing.filter(n=>n.endsWith('.yaml'))){
    const work=YAML.parse(await fs.readFile(path.join(workDir,name),'utf8'));
    if(work.hash===hash)return {status:'duplicate',id:work.id,published:work.published};
    if(work.id===id)throw new Error(`Slug ${id} already exists. Use a different title; existing work is never overwritten.`);
  }
  const work={id,title:title.trim(),collection:collection.trim(),description,alt,featured,published:publish,hash,image:`media/${id}.webp`,thumbnail:`media/${id}-thumb.webp`,width:display.info.width,height:display.info.height};
  if(dryRun)return {status:'dry-run',work};
  // Both drafts and published work are private until the build stages approved media.
  await fs.mkdir(path.join(root,'.private/derivatives'),{recursive:true});
  await fs.mkdir(path.join(root,'.private/originals'),{recursive:true});
  await fs.mkdir(workDir,{recursive:true});
  await fs.writeFile(path.join(root,'.private/originals',`${hash}.${metadata.format}`),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  await fs.writeFile(path.join(root,'.private/derivatives',`${id}.webp`),display.data);
  await fs.writeFile(path.join(root,'.private/derivatives',`${id}-thumb.webp`),thumbnail);
  await fs.writeFile(path.join(workDir,`${id}.yaml`),YAML.stringify(work),{flag:'wx'});
  return {status:'imported',id,published:publish};
}

export async function stageMedia(root) {
  const directory=path.join(root,'content/works');
  const names=await fs.readdir(directory).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  const publicDir=path.join(root,'public/media');
  await fs.mkdir(publicDir,{recursive:true});
  const allowed=new Set();
  for(const name of names.filter(n=>n.endsWith('.yaml'))){
    const work=YAML.parse(await fs.readFile(path.join(directory,name),'utf8'));
    if(!work.published)continue;
    if(slugify(work.id)!==work.id)throw new Error(`Invalid work ID: ${name}`);
    for(const suffix of ['.webp','-thumb.webp']){
      const file=work.id+suffix;allowed.add(file);
      await fs.copyFile(path.join(root,'.private/derivatives',file),path.join(publicDir,file));
    }
  }
  // Only this generated media directory is managed by this command.
  for(const name of await fs.readdir(publicDir)){
    if(!allowed.has(name)&&name.endsWith('.webp'))await fs.unlink(path.join(publicDir,name));
  }
  return {status:'staged',files:allowed.size};
}

async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:{title:{type:'string'},collection:{type:'string'},description:{type:'string'},alt:{type:'string'},featured:{type:'boolean'},publish:{type:'boolean'},'dry-run':{type:'boolean'}}});
  const [command,file]=positionals;
  if(command==='stage'){console.log(JSON.stringify(await stageMedia(process.cwd())));return;}
  if(command!=='add'||!file)throw new Error('Usage: npm run folio -- add IMAGE --title TITLE --alt DESCRIPTION [--collection NAME] [--featured] [--publish] [--dry-run]');
  if(values['dry-run']){console.log(JSON.stringify(await importImage({root:process.cwd(),file,...values,dryRun:true}),null,2));return;}
  await fs.mkdir(path.join(process.cwd(),'.private'),{recursive:true});
  const lock=path.join(process.cwd(),'.private/import.lock');
  const handle=await fs.open(lock,'wx').catch(e=>{if(e.code==='EEXIST')throw new Error('Another import is active. If interrupted, verify no import is running before removing .private/import.lock.');throw e;});
  try{console.log(JSON.stringify(await importImage({root:process.cwd(),file,...values,dryRun:values['dry-run']}),null,2));}
  finally{await handle.close();await fs.unlink(lock);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){main().catch(e=>{console.error(e.message);process.exitCode=1;});}
