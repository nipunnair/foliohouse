import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import YAML from 'yaml';
import {approveDraft,editDraft,previewDraft,publishDraft,readDraft} from '../scripts/review.mjs';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'folio-review-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const id='a'.repeat(64);const dir=path.join(root,'.private/queue/demo',id);await fs.mkdir(dir,{recursive:true});await fs.mkdir(path.join(root,'sites'));
 await fs.writeFile(path.join(root,'sites/demo.yaml'),YAML.stringify({id:'demo',mode:'draft-only',contentRoot:'.',publishLocal:true,collections:['Studies']}));
 const bytes=await sharp({create:{width:20,height:20,channels:3,background:'green'}}).png().toBuffer();
 await fs.writeFile(path.join(dir,'image-1.png'),bytes);await sharp(bytes).webp().toFile(path.join(dir,'preview-1.webp'));
 await fs.writeFile(path.join(dir,'submission.yaml'),YAML.stringify({id,site:'demo',state:'needs-review',title:'Green study',alt:'A green square',description:'A test study.',collection:'Studies',featured:false,images:[{filename:'image-1.png',preview:'preview-1.webp',hash:createHash('sha256').update(bytes).digest('hex')}]}));
 return {root,id,dir};
}
test('publish requires explicit approval',async t=>{const {root,id}=await fixture(t);await assert.rejects(publishDraft(root,'demo',id),/approval/);});
test('root publication requires an explicit deployment opt-in',async t=>{
 const {root,id}=await fixture(t);const file=path.join(root,'sites/demo.yaml');
 const site=YAML.parse(await fs.readFile(file,'utf8'));site.publishLocal=false;await fs.writeFile(file,YAML.stringify(site));
 await approveDraft(root,'demo',id);await assert.rejects(publishDraft(root,'demo',id,{dryRun:true}),/deployment target/);
});
test('placeholder alt and test subject cannot be approved',async t=>{const {root,id}=await fixture(t);await editDraft(root,'demo',id,{alt:'Describe the attached image here.'});await assert.rejects(approveDraft(root,'demo',id),/placeholder/);});
test('editing invalidates approval',async t=>{const {root,id}=await fixture(t);await approveDraft(root,'demo',id);await editDraft(root,'demo',id,{title:'Revised study'});await assert.rejects(publishDraft(root,'demo',id),/approval/);});
test('HTML review escapes supplied metadata and embeds previews privately',async t=>{const {root,id}=await fixture(t);await editDraft(root,'demo',id,{title:'<script>alert(1)</script>'});const file=await previewDraft(root,'demo',id);const html=await fs.readFile(file,'utf8');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('data:image/webp;base64,'));});
test('dry run creates no portfolio work',async t=>{const {root,id}=await fixture(t);await approveDraft(root,'demo',id);assert.equal((await publishDraft(root,'demo',id,{dryRun:true})).status,'dry-run');await assert.rejects(fs.stat(path.join(root,'content/works')));});
test('successful publish is idempotent',async t=>{const {root,id}=await fixture(t);await approveDraft(root,'demo',id);let calls=0;const deploy=async()=>{calls++;return {release:'test-release'};};assert.equal((await publishDraft(root,'demo',id,{deploy})).status,'published');assert.equal((await publishDraft(root,'demo',id,{deploy})).status,'already-published');assert.equal(calls,1);});
test('failed deployment restores nonpublic work and requires reconciliation',async t=>{const {root,id}=await fixture(t);await approveDraft(root,'demo',id);await assert.rejects(publishDraft(root,'demo',id,{deploy:async()=>{throw new Error('synthetic build failure');}}),/synthetic/);const work=YAML.parse(await fs.readFile(path.join(root,'content/works/green-study.yaml'),'utf8'));assert.equal(work.published,false);assert.equal((await readDraft(root,'demo',id)).record.state,'needs-reconciliation');});
test('modified original attachment blocks approval',async t=>{const {root,id,dir}=await fixture(t);await fs.writeFile(path.join(dir,'image-1.png'),'modified');await assert.rejects(approveDraft(root,'demo',id),/changed/);});
