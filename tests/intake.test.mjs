import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import YAML from 'yaml';
import {ingestEmail} from '../scripts/intake.mjs';
import {loadSite} from '../scripts/sites.mjs';
async function setup(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'folio-intake-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.mkdir(path.join(root,'sites'));
 await fs.writeFile(path.join(root,'sites/test.yaml'),YAML.stringify({id:'test',contentRoot:'.',inbox:'publish@example.com',allowedSenders:['owner@example.com'],collections:['Studies'],mode:'draft-only'}));
 const image=await sharp({create:{width:20,height:20,channels:3,background:'#ffffff'}}).png().toBuffer();
 const raw=Buffer.from(`From: owner@example.com\r\nTo: publish@example.com\r\nSubject: Test work\r\nMessage-ID: <test@example.com>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="test-boundary"\r\n\r\n--test-boundary\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nCollection: Studies\r\nAction: publish\r\nAlt: A white square\r\nFeatured: yes\r\n\r\nA synthetic test, not personal mail.\r\n--test-boundary\r\nContent-Type: image/png\r\nContent-Disposition: attachment; filename="../../outside.png"\r\nContent-Transfer-Encoding: base64\r\n\r\n${image.toString('base64')}\r\n--test-boundary--\r\n`);
 return {root,siteId:'test',raw};
}
test('email dry-run writes nothing; publish request stays in review',async t=>{const f=await setup(t);const result=await ingestEmail({...f,dryRun:true});assert.equal(result.record.state,'needs-review');assert.equal(result.record.requestedAction,'publish');assert.equal(result.record.senderAuthentication,'unverified');await assert.rejects(fs.stat(path.join(f.root,'.private')));});
test('queue is private, safe filenames, replay deduplicates',async t=>{const f=await setup(t);const result=await ingestEmail(f);assert.equal(result.status,'queued');assert.equal((await ingestEmail(f)).status,'duplicate');const dir=path.join(f.root,'.private/queue/test',result.id);assert.ok((await fs.readdir(dir)).includes('image-1.png'));await assert.rejects(fs.stat(path.join(f.root,'public')));await assert.rejects(fs.stat(path.join(f.root,'outside.png')));});
test('wrong sender and recipient rejected',async t=>{const f=await setup(t);await assert.rejects(ingestEmail({...f,raw:Buffer.from(f.raw.toString().replace('From: owner@example.com','From: attacker@example.com'))}),/allowlisted/);await assert.rejects(ingestEmail({...f,raw:Buffer.from(f.raw.toString().replace('To: publish@example.com','To: different@example.com'))}),/Recipient/);});
test('unknown collection and repeated control fields rejected',async t=>{const f=await setup(t);await assert.rejects(ingestEmail({...f,raw:Buffer.from(f.raw.toString().replace('Collection: Studies','Collection: Unapproved'))}),/Collection/);await assert.rejects(ingestEmail({...f,raw:Buffer.from(f.raw.toString().replace('Action: publish','Action: draft\r\nAction: publish'))}),/Repeated/);});
test('missing alt yields review warning rather than an invented caption',async t=>{const f=await setup(t);const result=await ingestEmail({...f,dryRun:true,raw:Buffer.from(f.raw.toString().replace('Alt: A white square\r\n',''))});assert.equal(result.record.alt,'');assert.ok(result.record.warnings.some(w=>w.includes('Alt text')));});
test('header changes do not bypass content deduplication',async t=>{const f=await setup(t);await ingestEmail(f);const result=await ingestEmail({...f,raw:Buffer.from(f.raw.toString().replace('<test@example.com>','<other@example.com>'))});assert.equal(result.status,'duplicate');});
test('site path traversal blocked',async t=>{const f=await setup(t);await assert.rejects(loadSite(f.root,'../test'),/Invalid site/);});
test('HTML-only email safely converts control fields to text',async t=>{const f=await setup(t);const raw=Buffer.from(f.raw.toString().replace('Content-Type: text/plain; charset=utf-8','Content-Type: text/html; charset=utf-8').replace('Collection: Studies\r\nAction: publish\r\nAlt: A white square\r\nFeatured: yes\r\n\r\nA synthetic test, not personal mail.','<p>Collection: Studies</p><p>Action: draft</p><p>Alt: A white square</p><p>Featured: no</p><p>A synthetic test.</p>'));const result=await ingestEmail({...f,raw,dryRun:true});assert.equal(result.record.collection,'Studies');assert.equal(result.record.requestedAction,'draft');assert.equal(result.record.state,'needs-review');});
test('malformed attachment rejected without queue writes',async t=>{const f=await setup(t);const raw=Buffer.from(f.raw.toString().replace(/(Content-Transfer-Encoding: base64\r\n\r\n)[^\r]+/,'$1bm90LWFuLWltYWdl'));await assert.rejects(ingestEmail({...f,raw}));await assert.rejects(fs.stat(path.join(f.root,'.private')));});
test('oversized email rejected before parsing',async t=>{const f=await setup(t);await assert.rejects(ingestEmail({...f,raw:Buffer.alloc(30*1024*1024+1)}),/30 MB/);});
