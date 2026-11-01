import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
const root = process.cwd();
export const site = YAML.parse(fs.readFileSync(path.join(root, 'content/site.yaml'), 'utf8'));
export interface Work { id:string; title:string; collection:string; description:string; alt:string; featured:boolean; published:boolean; image:string; thumbnail:string; width:number; height:number; hash:string; credit?:string; sourceUrl?:string; }
const dir = path.join(root, 'content/works');
export const works:Work[] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.yaml')).sort().map(f=>YAML.parse(fs.readFileSync(path.join(dir,f),'utf8'))).filter(w=>w.published) : [];
export const collections = [...new Set(works.map(w=>w.collection))];
export const url = (p:string='') => `${import.meta.env.BASE_URL.replace(/\/$/,'')}/${p.replace(/^\//,'')}`;
