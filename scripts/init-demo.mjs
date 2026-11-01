import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {importImage} from './folio.mjs';
const root=process.cwd();
if(process.argv.slice(2).some(a=>a!=='--dry-run'))throw new Error('Only --dry-run is supported');
for(const name of ['content/site.yaml','sites/demo.yaml']){
 try{await fs.access(path.join(root,name));throw new Error('Existing configuration: '+name+'; refusing to overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
}
if(process.argv.includes('--dry-run')){console.log('Would initialize generic branding, demo profile, and a synthetic image. No changes made.');process.exit(0);}
await fs.mkdir(path.join(root,'content'),{recursive:true});
await fs.mkdir(path.join(root,'sites'),{recursive:true});
await fs.copyFile(path.join(root,'examples/site.yaml'),path.join(root,'content/site.yaml'),fs.constants.COPYFILE_EXCL);
await fs.copyFile(path.join(root,'examples/profile.yaml'),path.join(root,'sites/demo.yaml'),fs.constants.COPYFILE_EXCL);
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'folio-demo-'));
try{
 const file=path.join(temp,'study.png');
 await sharp({create:{width:1200,height:900,channels:3,background:'#718574'}}).png().toFile(file);
 await importImage({root,file,title:'Green study',alt:'A solid muted green rectangular colour study',description:'Synthetic demonstration image generated locally.',collection:'Studies',publish:true,featured:true});
}finally{await fs.rm(temp,{recursive:true,force:true});}
console.log('Demo initialized. Run npm run dev.');
