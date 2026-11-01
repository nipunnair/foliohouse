import {promises as fs} from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
export async function loadSite(root,id){
 if(!/^[a-z][a-z0-9-]{0,49}$/.test(id||''))throw new Error('Invalid site ID');
 const site=YAML.parse(await fs.readFile(path.join(root,'sites',`${id}.yaml`),'utf8'));
 if(site.id!==id||site.mode!=='draft-only'||!Array.isArray(site.collections)||!site.collections.length)throw new Error('Invalid site configuration');
 const contentRoot=path.resolve(root,site.contentRoot);
 if(contentRoot!==root&&!contentRoot.startsWith(root+path.sep))throw new Error('Site content must remain inside the project');
 return {...site,contentRoot,allowedSenders:(site.allowedSenders||[]).map(s=>s.toLowerCase())};
}
