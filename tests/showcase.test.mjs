import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import YAML from 'yaml';
import sharp from 'sharp';
test('showcase has six distinct licensed-source images with descriptive metadata',async()=>{
 const works=YAML.parse(await fs.readFile('examples/showcase/works.yaml','utf8'));
 assert.equal(works.length,6);assert.equal(new Set(works.map(w=>w.museumId)).size,6);
 for(const work of works){
  assert.ok(Number.isSafeInteger(work.museumId));assert.ok(work.artist&&work.alt.length>20);
  assert.match(work.imageId,/^[a-f0-9-]+$/);
  const meta=await sharp('examples/showcase/assets/'+work.museumId+'.jpg').metadata();
  assert.equal(meta.format,'jpeg');assert.ok(meta.width>200);
 }
});
