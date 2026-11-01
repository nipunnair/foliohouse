import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {importImage,slugify,stageMedia} from '../scripts/folio.mjs';
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'folio-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const file=path.join(root,'input.png');await sharp({create:{width:32,height:48,channels:3,background:'#779944'}}).png().toFile(file);return {root,file,title:'A study',alt:'A green test rectangle'};}
test('slug normalization and empty rejection',()=>{assert.equal(slugify('Étude / One'),'etude-one');assert.throws(()=>slugify('...'));});
test('dry run does not create content',async t=>{const f=await fixture(t);assert.equal((await importImage({...f,dryRun:true})).status,'dry-run');await assert.rejects(fs.stat(path.join(f.root,'content')));});
test('duplicate is idempotent and originals stay private',async t=>{const f=await fixture(t);assert.equal((await importImage(f)).status,'imported');assert.equal((await importImage(f)).status,'duplicate');assert.equal((await stageMedia(f.root)).files,0);assert.deepEqual(await fs.readdir(path.join(f.root,'public/media')),[]);});
test('published images stage derivatives only',async t=>{const f=await fixture(t);await importImage({...f,publish:true});assert.equal((await stageMedia(f.root)).files,2);const meta=await sharp(path.join(f.root,'public/media/a-study.webp')).metadata();assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);});
test('invalid image and missing alt are rejected',async t=>{const f=await fixture(t);await assert.rejects(importImage({...f,alt:''}));await fs.writeFile(f.file,'not an image');await assert.rejects(importImage(f));});
test('slug collision cannot overwrite work',async t=>{const f=await fixture(t);await importImage(f);await sharp({create:{width:12,height:12,channels:3,background:'#000000'}}).png().toFile(f.file);await assert.rejects(importImage(f),/already exists/);});
