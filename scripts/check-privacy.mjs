import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/^(?:content\/|sites\/|portfolios\/|\.private\/|\.hosting\/|dist\/|demo-dist\/|public\/media\/|test-results\/)|(?:^|\/)\.env(?!\.example$)|\.(?:eml|pem|key)$/i;
const bad=files.filter(f=>forbidden.test(f)||f==='scripts/bootstrap.mjs');
if(bad.length){console.error('Private/generated paths tracked:',bad.join(', '));process.exit(1);}
console.log('Tracked-file privacy guard passed. Run Gitleaks separately for secret detection.');
